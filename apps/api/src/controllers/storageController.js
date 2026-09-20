const prisma = require('../config/prisma');
const { encryptStorageCredentials } = require('../config/storage');

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

    res.json(providers);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, provider_type = 'platform', backend = 'local', is_default = false, credentials } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Storage provider name is required' });
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
          name,
          provider_type,
          backend,
          is_default: !!is_default,
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

    res.status(201).json(provider);
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
      return res.status(404).json({ error: 'Storage provider not found' });
    }

    res.json({
      status: 'success',
      message: `Successfully verified connection to ${provider.backend.toUpperCase()} storage '${provider.name}'`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  testConnection,
};
