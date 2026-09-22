const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const sftpgoService = require('../services/sftpgoService');


function formatCameraDTO(c) {
  return {
    id: c.id,
    studio_id: c.studio_id,
    name: c.name,
    model: c.model,
    album_id: c.album_id,
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
    const password = upload_password || sftpgo_password || '';
    if (!/^[a-zA-Z0-9_-]{3,60}$/.test(username) || typeof password !== 'string' || password.length < 8) return res.status(400).json({error:'Use a 3–60 character username containing letters, numbers, underscores or hyphens, and a password of at least 8 characters.'});

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

    // Storage Destination (optional: can link to an external server or remain direct)
    let destinationId = storage_provider_id;
    if (destinationId) {
      const dest = await prisma.storage_providers.findFirst({
        where: { id: destinationId, studio_id: req.studioId, is_enabled: true },
      });
      if (!dest) {
        destinationId = null;
      }
    } else {
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
        storage_provider_id: destinationId || null,
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

    const studio = await prisma.studios.findUnique({ where: { id: req.studioId }, select: { slug: true } });
    try {
      await sftpgoService.provisionCameraUser({
        username,
        password,
        studioSlug: studio ? studio.slug : 'studio',
        cameraId: camera.id,
      });
    } catch (e) {
      console.warn('[Camera] Provisioning note:', e.message);
    }

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

    if (typeof is_active !== 'boolean') return res.status(400).json({error:'is_active must be a boolean'});
    const nextActive = is_active;
    await sftpgoService.setCameraActive({username:existing.sftpgo_username,active:nextActive});
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

    await sftpgoService.retireCameraUser({username:existing.sftpgo_username});
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

async function assignAlbum(req,res,next){try{
 const camera=await prisma.cameras.findFirst({where:{id:req.params.id,studio_id:req.studioId}});
 if(!camera)return res.status(404).json({error:'Camera not found'});
 const albumId=req.body.album_id || null;
 if(albumId && !await prisma.albums.findFirst({where:{id:albumId,studio_id:req.studioId}}))return res.status(400).json({error:'Album not found in this studio'});
 const updated=await prisma.cameras.update({where:{id:camera.id},data:{album_id:albumId},include:{storage_provider:true}});
 res.json(formatCameraDTO(updated));
 }catch(error){next(error);}}
async function deleteCamera(req, res, next) {
  try {
    const cameraId = req.params.id;
    const existing = await prisma.cameras.findFirst({
      where: { id: cameraId, studio_id: req.studioId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Camera not found' });
    }

    try {
      await sftpgoService.deleteCameraUser({ username: existing.sftpgo_username });
    } catch (e) {
      console.warn('[Camera] Delete SFTPGo user warning:', e.message);
    }

    await prisma.assets.updateMany({
      where: { camera_id: cameraId },
      data: { camera_id: null },
    });

    await prisma.cameras.delete({
      where: { id: cameraId },
    });

    res.json({ success: true, message: `Camera '${existing.name}' was permanently deleted and slot released.` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  assignAlbum,
  list,
  create,
  toggleActive,
  retire,
  delete: deleteCamera,
};
