const prisma = require('../config/prisma');
const { encryptStorageCredentials, decryptStorageCredentials } = require('../config/storage');
const { testConnection: probeStorage, getStorageUsage } = require('../services/storageAdapters');

const VALID_STUDIO_BACKENDS = new Set(['s3', 'sftp', 'ftp']);

function validateCredentials(backend,c) {
 const required=backend==='s3'?['bucket','region','accessKeyId','secretAccessKey']:['host','username'];
 if(!c || typeof c!=='object' || required.some(k=>typeof c[k]!=='string'||!c[k].trim()) || (backend!=='s3'&&!c.password&&!c.privateKey)) {const e=new Error('Complete the required credentials for '+backend.toUpperCase());e.statusCode=400;e.isPublic=true;throw e;}
 if(backend!=='s3' && (!Number.isInteger(Number(c.port))||Number(c.port)<1||Number(c.port)>65535)){const e=new Error('Port must be between 1 and 65535');e.statusCode=400;e.isPublic=true;throw e;}
}
function formatProviderDTO(p) {
  return {
    id: p.id,
    studio_id: p.studio_id,
    name: p.name,
    provider_type: p.provider_type,
    backend: p.backend,
    is_default: p.is_default,
    is_enabled: p.is_enabled,
    health: p.health,
    tested_at: p.tested_at,
    version: p.version,
    has_credentials: Boolean(p.storage_credentials && (!Array.isArray(p.storage_credentials) || p.storage_credentials.length > 0)),
    connection: (() => {
      const record=Array.isArray(p.storage_credentials)?p.storage_credentials[0]:p.storage_credentials;
      if(!record?.encrypted_config)return {};
      const config=decryptStorageCredentials(record.encrypted_config);
      const safe={};for(const key of ['host','port','username','root','bucket','region','endpoint','secure','forcePathStyle'])if(config[key]!==undefined)safe[key]=config[key];
      return safe;
    })(),
    created_at: p.created_at,
    capacity_gb: p.platform_capacity_gb || null,
    total_capacity_gb: p.platform_capacity_gb || null,
    platform_capacity_gb: p.platform_capacity_gb || null,
    platform_monthly_cost: p.platform_monthly_cost || null,
    platform_renewal_date: p.platform_renewal_date || null,
    platform_renewal_period: p.platform_renewal_period || null,
    platform_notes: p.platform_notes || null,
  };
}

async function list(req, res, next) {
  try {
    const providers = await prisma.storage_providers.findMany({
      where: { studio_id: req.studioId },
      include: {
        storage_credentials: {
          select: { id: true, created_at: true, encrypted_config: true },
        },
      },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });

    res.json(providers.map(formatProviderDTO));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, provider_type = 'studio_owned', backend = 's3', is_default = false, credentials, capacity_gb, platform_capacity_gb } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Storage connection name is required' });
    }

    // Critical Plan requirement: Studio admins cannot create platform-managed storage
    if (provider_type === 'platform') {
      return res.status(403).json({
        error: 'Platform-managed storage can only be provisioned by platform administrators. Use studio-owned storage (FTP, SFTP, S3).',
        code: 'PLATFORM_STORAGE_ADMIN_ONLY',
      });
    }

    if (!VALID_STUDIO_BACKENDS.has(backend)) {
      return res.status(400).json({ error: `Invalid storage backend '${backend}'. Supported: s3, sftp, ftp.` });
    }

    if (!credentials) {
      return res.status(400).json({ error: `Credentials are required for ${backend.toUpperCase()} storage connection.` });
    }

    validateCredentials(backend,credentials);
    const parsedCapacity = capacity_gb ? parseInt(capacity_gb, 10) : (platform_capacity_gb ? parseInt(platform_capacity_gb, 10) : null);
    const provider = await prisma.$transaction(async (tx) => {
      if (is_default) {
        await tx.storage_providers.updateMany({
          where: { studio_id: req.studioId },
          data: { is_default: false },
        });
      }

      const p = await tx.storage_providers.create({
        data: {
          studio_id: req.studioId,
          name: name.trim(),
          provider_type: 'studio_owned',
          backend,
          is_default: !!is_default,
          is_enabled: true,
          health: 'untested',
          platform_capacity_gb: parsedCapacity,
        },
      });

      if (credentials) {
        const encrypted = encryptStorageCredentials(credentials);
        await tx.storage_credentials.create({
          data: {
            storage_provider_id: p.id,
            encrypted_config: encrypted,
          },
        });
      }

      return p;
    });

    res.status(201).json(formatProviderDTO(provider));
  } catch (err) {
    next(err);
  }
}

async function testConnection(req, res, next) {
  try {
    const providerId = req.params.id;
    const provider = await prisma.storage_providers.findFirst({
      where: { id: providerId, studio_id: req.studioId },
      include: { storage_credentials: true },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Storage connection not found' });
    }

    const testRes = await probeStorage(provider);

    await prisma.storage_providers.update({
      where: { id: provider.id },
      data: {
        health: testRes.success ? 'healthy' : 'error',
        tested_at: testRes.tested_at,
      },
    });

    if (!testRes.success) {
      return res.status(400).json({
        status: 'error',
        code: 'CONNECTION_TEST_FAILED',
        error: testRes.error || 'Connection probe failed',
        capabilities: testRes.capabilities,
        tested_at: testRes.tested_at,
      });
    }

    res.json({
      status: 'success',
      message: testRes.message,
      capabilities: testRes.capabilities,
      tested_at: testRes.tested_at,
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const providerId = req.params.id;
    const { name, is_default, is_enabled, credentials, capacity_gb, platform_capacity_gb } = req.body;

    const existing = await prisma.storage_providers.findFirst({
      where: { id: providerId, studio_id: req.studioId },
      include: {storage_credentials:true},
    });

    if (!existing) {
      return res.status(404).json({ error: 'Storage connection not found' });
    }

    const parsedCapacity = capacity_gb !== undefined ? (capacity_gb ? parseInt(capacity_gb, 10) : null) : (platform_capacity_gb !== undefined ? (platform_capacity_gb ? parseInt(platform_capacity_gb, 10) : null) : undefined);

    const updated = await prisma.$transaction(async (tx) => {
      if (is_default) {
        await tx.storage_providers.updateMany({
          where: { studio_id: req.studioId },
          data: { is_default: false },
        });
      }

      const p = await tx.storage_providers.update({
        where: { id: providerId },
        data: {
          name: name ? name.trim() : undefined,
          is_default: is_default !== undefined ? !!is_default : undefined,
          is_enabled: is_enabled !== undefined ? !!is_enabled : undefined,
          platform_capacity_gb: parsedCapacity !== undefined ? parsedCapacity : undefined,
          version: { increment: 1 },
          ...(credentials ? {health:"untested",tested_at:null} : {}),
        },
      });

      if (credentials && typeof credentials === 'object' && Object.keys(credentials).length > 0) {
        const record=Array.isArray(existing.storage_credentials)?existing.storage_credentials[0]:existing.storage_credentials;
        const previous=record?.encrypted_config?decryptStorageCredentials(record.encrypted_config):{};
        const merged={...previous,...credentials};
        for(const key of ['password','secretAccessKey','accessKeyId','privateKey','passphrase'])if(!credentials[key]&&previous[key])merged[key]=previous[key];
        validateCredentials(existing.backend,merged);
        const encrypted = encryptStorageCredentials(merged);
        const existingCred = await tx.storage_credentials.findFirst({
          where: { storage_provider_id: providerId },
        });
        if (existingCred) {
          await tx.storage_credentials.update({
            where: { id: existingCred.id },
            data: { encrypted_config: encrypted },
          });
        } else {
          await tx.storage_credentials.create({
            data: {
              storage_provider_id: providerId,
              encrypted_config: encrypted,
            },
          });
        }
      }

      return p;
    });

    res.json(formatProviderDTO(updated));
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const providerId = req.params.id;

    const provider = await prisma.storage_providers.findFirst({
      where: { id: providerId, studio_id: req.studioId },
    });

    if (!provider) {
      return res.status(404).json({ error: 'Storage connection not found' });
    }


    // Check if cameras or assets are attached
    const attachedCameras = await prisma.cameras.count({
      where: { storage_provider_id: providerId, lifecycle: { not: 'retired' } },
    });
    const attachedAssets = await prisma.assets.count({
      where: { storage_provider_id: providerId, is_soft_deleted: false },
    });

    if (attachedCameras > 0 || attachedAssets > 0) {
      // Archive instead of deleting to preserve provenance
      const archived = await prisma.storage_providers.update({
        where: { id: providerId },
        data: { is_enabled: false, is_default: false },
      });
      return res.json({
        message: 'Storage connection contains referenced cameras or assets. It has been archived and disabled from new uploads.',
        provider: formatProviderDTO(archived),
      });
    }

    await prisma.storage_providers.delete({ where: { id: providerId } });
    res.json({ message: 'Storage connection removed successfully' });
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    const where = { id: req.params.id };
    if (req.studioId) where.studio_id = req.studioId;

    const provider = await prisma.storage_providers.findFirst({
      where,
      include: { storage_credentials: true },
    });
    if (!provider) return res.status(404).json({ error: 'Storage provider not found' });
    const stats = await getStorageUsage(provider);
    let totalBytes = stats.total_bytes;
    let freeBytes = stats.free_bytes;
    let usedBytes = stats.used_bytes;

    if (usedBytes == null) {
      const dbSum = await prisma.assets.aggregate({
        where: { storage_provider_id: provider.id, is_soft_deleted: false },
        _sum: { file_size_bytes: true },
        _count: { id: true },
      });
      usedBytes = Number(dbSum._sum.file_size_bytes || 0);
      if ((!stats.file_count || stats.file_count === 0) && dbSum._count.id > 0) {
        stats.file_count = dbSum._count.id;
      }
    }

    if ((totalBytes == null || totalBytes === 0) && provider.platform_capacity_gb) {
      totalBytes = Number(provider.platform_capacity_gb) * 1024 * 1024 * 1024;
      freeBytes = totalBytes > (usedBytes || 0) ? totalBytes - (usedBytes || 0) : 0;
    }

    res.json({
      provider_id: provider.id,
      capacity_gb: provider.platform_capacity_gb || null,
      platform_capacity_gb: provider.platform_capacity_gb || null,
      ...stats,
      used_bytes: usedBytes,
      total_bytes: totalBytes,
      free_bytes: freeBytes,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  testConnection,
  update,
  remove,
  getStats,
};
