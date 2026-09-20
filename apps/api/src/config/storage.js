const crypto = require('crypto');
const env = require('./env');

const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.scryptSync(env.CREDENTIAL_ENCRYPTION_KEY, 'salt', 32);

function encryptStorageCredentials(plainTextObject) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(JSON.stringify(plainTextObject), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');

  return JSON.stringify({
    iv: iv.toString('hex'),
    authTag,
    encryptedData: encrypted
  });
}

function decryptStorageCredentials(encryptedJsonString) {
  try {
    const { iv, authTag, encryptedData } = JSON.parse(encryptedJsonString);
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      KEY,
      Buffer.from(iv, 'hex')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch (err) {
    console.error('Credential decryption error:', err);
    throw new Error('Failed to decrypt storage credentials');
  }
}

module.exports = {
  encryptStorageCredentials,
  decryptStorageCredentials
};
