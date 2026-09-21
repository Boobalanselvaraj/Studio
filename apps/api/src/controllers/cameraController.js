const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { provisionSftpgoUser } = require('../config/sftpgo');
const { checkCameraLimit } = require('../services/allocationService');

function formatCameraDTO(c) {
  return {
    id: c.id,
    studio_id: c.studio_id,
    name: c.name,
    model: c.model,
    storage_provider_id: c.storage_provider_id,
    storage_provider: c.storage_provider
      ? {
          id: c.storage_provider.id,
          name: c.storage_provider.name,
          backend: c.storage_provider.backend,
          provider_type: c.storage_provider.provider_type,
        }
      : null,
    lifecycle: c.lifecycle,
    upload_username: c.sftpgo_username,
    sftpgo_username: c.sftpgo_username, // backward-compatibility
    is_active: c.is_active,
    retired_at: c.retired_at,
    last_sync_at: c.last_sync_at,
    created_at: c.created_at,
  };
}

async function list(req, res, next) {
  try {
    const cameras = await prisma.cameras.findMany({
      where: { studio_id: req.studioId },
      include: {
        storage_provider: true,
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(cameras.map(formatCameraDTO));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const {
      name,
      model,
      storage_provider_id,
      upload_username,
      upload_password,
      sftpgo_username,
      sftpgo_password,
      operation_key,
    } = req.body;

    const username = (upload_username || sftpgo_username || '').trim();
    const password = (upload_password || sftpgo_password || '').trim();

    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Camera name, upload username, and password are required' });
    }

    // Idempotent operation key check
    if (operation_key) {
      const existingOp = await prisma.cameras.findFirst({
        where: { studio_id: req.studioId, operation_key },
        include: { storage_provider: true },
      });
      if (existingOp) {
        return res.status(200).json(formatCameraDTO(existingOp));
      }
    }

    // 1. Quota Enforcement: Verify studio has available camera slot
    const quota = await checkCameraLimit(req.studioId);
    if (!quota.allowed) {
      return res.status(403).json({
        error: `Camera limit of ${quota.limit} reached (${quota.reserved} slots reserved). Upgrade tier or retire inactive cameras.`,
        code: 'CAMERA_LIMIT_REACHED',
        limit: quota.limit,
        reserved: quota.reserved,
      });
    }

    // 2. Validate Storage Destination
    let destinationId = storage_provider_id;
    if (destinationId) {
      const dest = await prisma.storage_providers.findFirst({
        where: { id: destinationId, studio_id: req.studioId, is_enabled: true },
      });
      if (!dest) {
        return res.status(400).json({ error: 'Selected storage connection does not belong to this studio or is disabled' });
      }
    } else {
      // Find default or first enabled storage provider
      const defDest = await prisma.storage_providers.findFirst({
        where: { studio_id: req.studioId, is_enabled: true },
        orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
      });
      if (defDest) destinationId = defDest.id;
    }

    // 3. Username uniqueness
    const existingUsername = await prisma.cameras.findUnique({
      where: { sftpgo_username: username },
    });
    if (existingUsername) {
      return res.status(409).json({ error: 'Upload username is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const camera = await prisma.cameras.create({
      data: {
        studio_id: req.studioId,
        name: name.trim(),
        model: model ? model.trim() : null,
        storage_provider_id: destinationId,
        lifecycle: 'ready',
        operation_key: operation_key || null,
        sftpgo_username: username,
        sftpgo_password_hash: passwordHash,
        is_active: true,
      },
      include: {
        storage_provider: true,
      },
    });

    // Background gateway provisioning if available
    provisionSftpgoUser(username, password).catch((err) => {
      console.warn('[Camera] Background SFTPGo provisioning note:', err.message);
    });

    res.status(201).json(formatCameraDTO(camera));
  } catch (err) {
    next(err);
  }
}

async function toggleActive(req, res, next) {
  try {
    const cameraId = req.params.id;
    const { is_active } = req.body;

    const existing = await prisma.cameras.findFirst({
      where: {
        id: cameraId,
        studio_id: req.studioId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Camera not found' });
    }

    if (existing.lifecycle === 'retired') {
      return res.status(400).json({ error: 'Retired cameras cannot be re-enabled. Register a new camera slot.' });
    }

    const nextActive = Boolean(is_active);
    const camera = await prisma.cameras.update({
      where: { id: cameraId },
      data: {
        is_active: nextActive,
        lifecycle: nextActive ? 'ready' : 'disabled',
      },
      include: {
        storage_provider: true,
      },
    });

    res.json(formatCameraDTO(camera));
  } catch (err) {
    next(err);
  }
}

async function retire(req, res, next) {
  try {
    const cameraId = req.params.id;

    const existing = await prisma.cameras.findFirst({
      where: { id: cameraId, studio_id: req.studioId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Camera not found' });
    }

    // Plan requirement: Retiring frees the slot permanently while preserving media provenance
    const retired = await prisma.cameras.update({
      where: { id: cameraId },
      data: {
        lifecycle: 'retired',
        is_active: false,
        retired_at: new Date(),
      },
      include: {
        storage_provider: true,
      },
    });

    res.json({
      message: `Camera '${retired.name}' retired. Slot released. Associated assets and history are preserved.`,
      camera: formatCameraDTO(retired),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  toggleActive,
  retire,
};
