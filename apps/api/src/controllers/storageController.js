const prisma = require('../config/prisma');
const { encryptStorageCredentials } = require('../config/storage');
const { testConnection: probeStorage } = require('../services/storageAdapters');

const VALID_STUDIO_BACKENDS = new Set(['s3', 'sftp', 'ftp']);

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
    created_at: p.created_at,
  };
}

async function list(req, res, next) {
  try {
    const providers = await prisma.storage_providers.findMany({
      where: { studio_id: req.studioId },
      include: {
        storage_credentials: {
          select: { id: true, created_at: true },
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
    const { name, provider_type = 'studio_owned', backend = 's3', is_default = false, credentials } = req.body;

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
    const { name, is_default, is_enabled, credentials } = req.body;

    const existing = await prisma.storage_providers.findFirst({
      where: { id: providerId, studio_id: req.studioId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Storage connection not found' });
    }

    if (existing.provider_type === 'platform' && req.user?.is_super_admin !== true) {
      return res.status(403).json({ error: 'Platform storage configuration cannot be modified by studio owners' });
    }

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
          version: { increment: 1 },
        },
      });

      if (credentials && typeof credentials === 'object' && Object.keys(credentials).length > 0) {
        const encrypted = encryptStorageCredentials(credentials);
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

    if (provider.provider_type === 'platform') {
      return res.status(403).json({ error: 'Platform storage cannot be deleted by studio' });
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

module.exports = {
  list,
  create,
  testConnection,
  update,
  remove,
};
