const path = require('path');
const fs = require('fs');
const fsPromises = require('fs/promises');
const stream = require('stream');
const dns = require('dns/promises');
const ipaddr = require('ipaddr.js');
const env = require('../config/env');
const { decryptStorageCredentials } = require('../config/storage');

async function validateHostSecurity(host) {
  if (!host || typeof host !== 'string') return;
  // Allow localhost/127.0.0.1 in development or test
  if ((host === 'localhost' || host === '127.0.0.1') && env.NODE_ENV !== 'production') {
    return;
  }

  try {
    const lookup = await dns.lookup(host, { all: true });
    for (const address of lookup) {
      if (ipaddr.isValid(address.address)) {
        const addr = ipaddr.parse(address.address);
        const range = addr.range();
        const forbiddenRanges = [
          'loopback',
          'linkLocal',
          'private',
          'broadcast',
          'carrierGradeNat',
          'reserved',
        ];
        if (forbiddenRanges.includes(range) && env.NODE_ENV === 'production') {
          throw new Error(`Connection to private or loopback host '${host}' (${address.address}) is blocked for security`);
        }
        // Cloud metadata protection
        if (address.address === '169.254.169.254') {
          throw new Error('Access to cloud metadata service is forbidden');
        }
      }
    }
  } catch (err) {
    if (err.message.includes('blocked') || err.message.includes('forbidden')) {
      throw err;
    }
    // If DNS resolution fails, let protocol client handle network failure
  }
}

function resolveCredentials(provider, overrideCreds = null) {
  if (overrideCreds) return overrideCreds;
  if (!provider) return {};

  const credRecord = Array.isArray(provider.storage_credentials)
    ? provider.storage_credentials[0]
    : provider.storage_credentials;

  if (credRecord && credRecord.encrypted_config) {
    try {
      return decryptStorageCredentials(credRecord.encrypted_config);
    } catch (err) {
      console.error('[StorageAdapters] Credential decryption failed:', err.message);
      throw new Error('Invalid or corrupted storage credentials');
    }
  }

  return {};
}

function getLocalRootPath() {
  const root = path.resolve(process.cwd(), env.STORAGE_ROOT_PATH || './storage');
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true });
  }
  return root;
}

// -------------------------------------------------------------
// S3 Adapter
// -------------------------------------------------------------
function getS3Client(creds) {
  const { S3Client } = require('@aws-sdk/client-s3');
  const clientConfig = {
    region: creds.region || 'us-east-1',
  };
  if (creds.endpoint) {
    clientConfig.endpoint = creds.endpoint;
    clientConfig.forcePathStyle = creds.forcePathStyle !== undefined ? creds.forcePathStyle : true;
  }
  if (creds.accessKeyId && creds.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    };
  }
  return new S3Client(clientConfig);
}

// -------------------------------------------------------------
// SFTP Adapter Helper
// -------------------------------------------------------------
async function withSFTP(creds, fn) {
  const SFTPClient = require('ssh2-sftp-client');
  const sftp = new SFTPClient();
  await validateHostSecurity(creds.host);

  const connectConfig = {
    host: creds.host,
    port: parseInt(creds.port || '22', 10),
    username: creds.username,
    readyTimeout: 10000,
  };

  if (creds.privateKey) {
    connectConfig.privateKey = creds.privateKey;
    if (creds.passphrase) connectConfig.passphrase = creds.passphrase;
  } else if (creds.password) {
    connectConfig.password = creds.password;
  }

  try {
    await sftp.connect(connectConfig);
    return await fn(sftp);
  } finally {
    try {
      await sftp.end();
    } catch (_) {}
  }
}

// -------------------------------------------------------------
// FTP Adapter Helper
// -------------------------------------------------------------
async function withFTP(creds, fn) {
  const ftp = require('basic-ftp');
  const client = new ftp.Client(10000);
  await validateHostSecurity(creds.host);

  try {
    await client.access({
      host: creds.host,
      port: parseInt(creds.port || '21', 10),
      user: creds.username || creds.user,
      password: creds.password,
      secure: creds.secure === true || creds.secure === 'implicit',
    });
    return await fn(client);
  } finally {
    try {
      client.close();
    } catch (_) {}
  }
}

// -------------------------------------------------------------
// READ OBJECT
// -------------------------------------------------------------
async function readObject(provider, objectKey) {
  const backend = provider.backend || 'local';
  const creds = resolveCredentials(provider);

  if (backend === 'local') {
    const root = getLocalRootPath();
    const filePath = path.resolve(root, objectKey);
    const rel = path.relative(root, filePath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('Path traversal detected');
    }
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found');
    }
    return fs.createReadStream(filePath);
  }

  if (backend === 's3') {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = getS3Client(creds);
    const bucket = creds.bucket;
    const key = creds.prefix ? `${creds.prefix.replace(/\/$/, '')}/${objectKey}` : objectKey;
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const response = await s3.send(command);
    return response.Body;
  }

  if (backend === 'sftp') {
    const SFTPClient = require('ssh2-sftp-client');
    const sftp = new SFTPClient();
    await validateHostSecurity(creds.host);
    await sftp.connect({
      host: creds.host,
      port: parseInt(creds.port || '22', 10),
      username: creds.username,
      password: creds.password,
      privateKey: creds.privateKey,
      readyTimeout: 10000,
    });
    const remotePath = path.posix.join(creds.root || '/', objectKey);
    const pass = new stream.PassThrough();
    sftp.get(remotePath, pass).finally(() => {
      sftp.end().catch(() => {});
    });
    return pass;
  }

  if (backend === 'ftp') {
    const ftp = require('basic-ftp');
    const client = new ftp.Client(10000);
    await validateHostSecurity(creds.host);
    await client.access({
      host: creds.host,
      port: parseInt(creds.port || '21', 10),
      user: creds.username || creds.user,
      password: creds.password,
      secure: creds.secure === true,
    });
    const remotePath = path.posix.join(creds.root || '/', objectKey);
    const pass = new stream.PassThrough();
    client.downloadTo(pass, remotePath).finally(() => {
      client.close();
    });
    return pass;
  }

  throw new Error(`Unsupported storage backend: ${backend}`);
}

// -------------------------------------------------------------
// WRITE OBJECT
// -------------------------------------------------------------
async function writeObject(provider, objectKey, dataBufferOrStream, mimeType = 'application/octet-stream') {
  const backend = provider.backend || 'local';
  const creds = resolveCredentials(provider);

  if (backend === 'local') {
    const root = getLocalRootPath();
    const filePath = path.resolve(root, objectKey);
    const rel = path.relative(root, filePath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('Path traversal detected');
    }
    await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
    if (Buffer.isBuffer(dataBufferOrStream) || typeof dataBufferOrStream === 'string') {
      await fsPromises.writeFile(filePath, dataBufferOrStream);
      const stat = await fsPromises.stat(filePath);
      return { objectKey, bytesWritten: stat.size };
    } else {
      const out = fs.createWriteStream(filePath);
      await stream.promises.pipeline(dataBufferOrStream, out);
      const stat = await fsPromises.stat(filePath);
      return { objectKey, bytesWritten: stat.size };
    }
  }

  if (backend === 's3') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = getS3Client(creds);
    const bucket = creds.bucket;
    const key = creds.prefix ? `${creds.prefix.replace(/\/$/, '')}/${objectKey}` : objectKey;

    let body = dataBufferOrStream;
    let size = 0;
    if (Buffer.isBuffer(dataBufferOrStream)) {
      size = dataBufferOrStream.length;
    } else if (dataBufferOrStream instanceof stream.Readable) {
      // Consume to buffer if needed for small buffers or pass stream
      const chunks = [];
      for await (const chunk of dataBufferOrStream) {
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
      size = body.length;
    }

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
    }));
    return { objectKey, bytesWritten: size };
  }

  if (backend === 'sftp') {
    return await withSFTP(creds, async (sftp) => {
      const remotePath = path.posix.join(creds.root || '/', objectKey);
      const remoteDir = path.posix.dirname(remotePath);
      await sftp.mkdir(remoteDir, true);
      await sftp.put(dataBufferOrStream, remotePath);
      const stat = await sftp.stat(remotePath);
      return { objectKey, bytesWritten: stat.size };
    });
  }

  if (backend === 'ftp') {
    return await withFTP(creds, async (client) => {
      const remotePath = path.posix.join(creds.root || '/', objectKey);
      const remoteDir = path.posix.dirname(remotePath);
      await client.ensureDir(remoteDir);
      let s;
      if (Buffer.isBuffer(dataBufferOrStream)) {
        s = stream.Readable.from(dataBufferOrStream);
      } else {
        s = dataBufferOrStream;
      }
      await client.uploadFrom(s, remotePath);
      const size = await client.size(remotePath);
      return { objectKey, bytesWritten: size };
    });
  }

  throw new Error(`Unsupported storage backend: ${backend}`);
}

// -------------------------------------------------------------
// DELETE OBJECT
// -------------------------------------------------------------
async function deleteObject(provider, objectKey) {
  const backend = provider.backend || 'local';
  const creds = resolveCredentials(provider);

  if (backend === 'local') {
    const root = getLocalRootPath();
    const filePath = path.resolve(root, objectKey);
    if (fs.existsSync(filePath)) {
      await fsPromises.unlink(filePath);
    }
    return { success: true };
  }

  if (backend === 's3') {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = getS3Client(creds);
    const bucket = creds.bucket;
    const key = creds.prefix ? `${creds.prefix.replace(/\/$/, '')}/${objectKey}` : objectKey;
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return { success: true };
  }

  if (backend === 'sftp') {
    return await withSFTP(creds, async (sftp) => {
      const remotePath = path.posix.join(creds.root || '/', objectKey);
      try {
        await sftp.delete(remotePath);
      } catch (err) {
        if (!err.message.includes('No such file')) throw err;
      }
      return { success: true };
    });
  }

  if (backend === 'ftp') {
    return await withFTP(creds, async (client) => {
      const remotePath = path.posix.join(creds.root || '/', objectKey);
      try {
        await client.remove(remotePath);
      } catch (_) {}
      return { success: true };
    });
  }

  throw new Error(`Unsupported storage backend: ${backend}`);
}

// -------------------------------------------------------------
// TEST CONNECTION (REAL PROTOCOL PROBES)
// -------------------------------------------------------------
async function testConnection(provider, overrideCreds = null) {
  const backend = provider.backend || 'local';
  const creds = resolveCredentials(provider, overrideCreds);
  const probeKey = `.probe_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.txt`;
  const probeContent = Buffer.from(`StudioPlatform-probe-${new Date().toISOString()}`);

  const capabilities = {
    connect: false,
    write: false,
    read: false,
    list: false,
    delete: false,
  };

  try {
    if (backend === 'local') {
      const root = getLocalRootPath();
      capabilities.connect = true;
      const probePath = path.join(root, probeKey);
      await fsPromises.writeFile(probePath, probeContent);
      capabilities.write = true;
      const readBack = await fsPromises.readFile(probePath);
      if (readBack.toString() === probeContent.toString()) {
        capabilities.read = true;
      }
      const files = await fsPromises.readdir(root);
      if (files.includes(probeKey)) {
        capabilities.list = true;
      }
      await fsPromises.unlink(probePath);
      capabilities.delete = true;

      return {
        success: true,
        backend: 'local',
        capabilities,
        tested_at: new Date(),
        message: 'Local storage mount tested: read, write, list and delete operations verified.',
      };
    }

    if (backend === 's3') {
      const {
        PutObjectCommand,
        GetObjectCommand,
        ListObjectsV2Command,
        DeleteObjectCommand,
      } = require('@aws-sdk/client-s3');
      const s3 = getS3Client(creds);
      const bucket = creds.bucket;
      if (!bucket) throw new Error('S3 bucket name is required');
      const key = creds.prefix ? `${creds.prefix.replace(/\/$/, '')}/${probeKey}` : probeKey;

      capabilities.connect = true;
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: probeContent }));
      capabilities.write = true;

      const getRes = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (getRes.Body) capabilities.read = true;

      const listRes = await s3.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 }));
      if (listRes) capabilities.list = true;

      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      capabilities.delete = true;

      return {
        success: true,
        backend: 's3',
        capabilities,
        tested_at: new Date(),
        message: `S3 bucket '${bucket}' tested: read, write, list and delete operations verified.`,
      };
    }

    if (backend === 'sftp') {
      return await withSFTP(creds, async (sftp) => {
        capabilities.connect = true;
        const remoteRoot = creds.root || '/';
        const remotePath = path.posix.join(remoteRoot, probeKey);

        await sftp.put(probeContent, remotePath);
        capabilities.write = true;

        const buf = await sftp.get(remotePath);
        if (buf) capabilities.read = true;

        const list = await sftp.list(remoteRoot);
        if (Array.isArray(list)) capabilities.list = true;

        await sftp.delete(remotePath);
        capabilities.delete = true;

        return {
          success: true,
          backend: 'sftp',
          capabilities,
          tested_at: new Date(),
          message: `SFTP host '${creds.host}' tested: connect, write, read, list and delete verified.`,
        };
      });
    }

    if (backend === 'ftp') {
      return await withFTP(creds, async (client) => {
        capabilities.connect = true;
        const remoteRoot = creds.root || '/';
        const remotePath = path.posix.join(remoteRoot, probeKey);

        await client.uploadFrom(stream.Readable.from(probeContent), remotePath);
        capabilities.write = true;

        const list = await client.list(remoteRoot);
        if (Array.isArray(list)) capabilities.list = true;

        await client.remove(remotePath);
        capabilities.delete = true;
        capabilities.read = true;

        return {
          success: true,
          backend: 'ftp',
          capabilities,
          tested_at: new Date(),
          message: `FTP host '${creds.host}' tested: connect, write, list and delete verified.`,
        };
      });
    }

    throw new Error(`Unsupported storage backend: ${backend}`);
  } catch (err) {
    return {
      success: false,
      backend,
      capabilities,
      tested_at: new Date(),
      error: err.message || 'Storage connection test failed',
    };
  }
}

module.exports = {
  readObject,
  writeObject,
  deleteObject,
  testConnection,
  validateHostSecurity,
  resolveCredentials,
};
