const path = require('path');
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
        where: { id: destinationId, studio_id: req.studioId, is_enabled: true, backend:{in:["sftp","ftp","s3"]} },
      });
      if (!dest) {
        return res.status(400).json({error:'Select an enabled external storage connection in this studio'});
      }
    } else {
      const defDest = await prisma.storage_providers.findFirst({
        where: { studio_id: req.studioId, is_enabled: true },
        orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
      });
      if (defDest) destinationId = defDest.id;
    }

    if (!destinationId) return res.status(400).json({error:'Connect external SFTP, FTP or S3 storage before registering a camera'});

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
      await prisma.cameras.delete({where:{id:camera.id}});
      return res.status(502).json({error:'Camera gateway provisioning failed. Verify SFTPGo admin credentials and writable landing directory, then retry.'});
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

async function getCameraAssets(req, res, next) {
  try {
    const cameraId = req.params.id;
    const camera = await prisma.cameras.findFirst({
      where: { id: cameraId, studio_id: req.studioId },
    });
    if (!camera) return res.status(404).json({ error: 'Camera not found' });

    const assets = await prisma.assets.findMany({
      where: { camera_id: cameraId, studio_id: req.studioId, is_soft_deleted: false },
      include: {
        album_assets: {
          include: {
            album: { select: { id: true, title: true, is_published: true } },
          },
        },
        storage_provider: { select: { id: true, name: true, backend: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const formatted = assets.map((a) => ({
      id: a.id,
      filename: a.filename,
      mime_type: a.mime_type,
      file_size_bytes: a.file_size_bytes ? a.file_size_bytes.toString() : '0',
      created_at: a.created_at,
      url: `/api/studio/folders/assets/${a.id}/view`,
      storage_provider: a.storage_provider || null,
      albums: a.album_assets.map((aa) => aa.album),
    }));

    res.json({
      camera: formatCameraDTO(camera),
      total_count: formatted.length,
      assets: formatted,
    });
  } catch (err) {
    next(err);
  }
}

async function uploadCameraPhoto(req, res, next) {
  try {
    const cameraId = req.params.id;
    const camera = await prisma.cameras.findFirst({
      where: { id: cameraId, studio_id: req.studioId },
      include: {
        storage_provider: {
          include: { storage_credentials: true },
        },
      },
    });
    if (!camera) return res.status(404).json({ error: 'Camera not found' });
    if (camera.lifecycle === 'retired') {
      return res.status(400).json({ error: 'Cannot upload to a retired camera' });
    }

    const filename = (req.headers['x-filename'] || req.query.filename || `photo_${Date.now()}.jpg`).toString().trim();
    const mimeType = req.headers['content-type'] || 'image/jpeg';
    const declaredSize = parseInt(req.headers['content-length'] || req.headers['x-file-size'] || '0', 10);

    let provider = camera.storage_provider;
    let storageProviderId = camera.storage_provider_id;
    if (!provider) {
      provider = await prisma.storage_providers.findFirst({
        where: { studio_id: req.studioId, is_enabled: true },
        orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
        include: { storage_credentials: true },
      });
      if (provider) storageProviderId = provider.id;
    }

    const { sanitizePathSegment } = require('../services/cameraIngest');
    const studio = await prisma.studios.findUnique({
      where: { id: req.studioId },
      select: { slug: true, name: true },
    });
    const studioFolder = sanitizePathSegment(studio?.slug || studio?.name, 'studio');

    let folderCategory = '';
    if (camera.album_id) {
      const album = await prisma.albums.findFirst({
        where: { id: camera.album_id, studio_id: req.studioId },
        select: { id: true, title: true },
      });
      if (album && album.title) {
        folderCategory = `Albums/${sanitizePathSegment(album.title, 'Album-' + album.id.slice(0, 8))}`;
      }
    }

    if (!folderCategory) {
      const cameraFolder = sanitizePathSegment(camera.name || camera.sftpgo_username, 'Camera-' + camera.id.slice(0, 8));
      const shootDate = new Date().toISOString().slice(0, 10);
      folderCategory = `Cameras/${cameraFolder}/${shootDate}`;
    }

    const ext = path.extname(filename).toLowerCase();
    const stem = sanitizePathSegment(path.basename(filename, ext), 'photo');
    const safeName = `${stem}${ext}`;
    let objectKey = `${studioFolder}/${folderCategory}/${safeName}`;

    const existingAsset = await prisma.assets.findFirst({
      where: { studio_id: req.studioId, object_key: objectKey },
      select: { id: true },
    });
    if (existingAsset) {
      objectKey = `${studioFolder}/${folderCategory}/${stem}_${Date.now().toString().slice(-4)}${ext}`;
    }

    let actualBytes = declaredSize;
    if (provider) {
      const { writeObject } = require('../services/storageAdapters');
      const result = await writeObject(provider, objectKey, req, mimeType);
      actualBytes = result?.bytesWritten || declaredSize;
    }

    const asset = await prisma.$transaction(async (tx) => {
      const newAsset = await tx.assets.create({
        data: {
          studio_id: req.studioId,
          camera_id: camera.id,
          storage_provider_id: storageProviderId || null,
          filename: path.basename(filename),
          original_path: objectKey,
          object_key: objectKey,
          mime_type: mimeType,
          file_size_bytes: BigInt(actualBytes || 0),
          processing_state: 'ready',
        },
      });

      // Link to camera-specific folder
      let folder = await tx.folders.findFirst({
        where: { studio_id: req.studioId, name: 'Camera — ' + camera.name, parent_folder_id: null },
      });
      if (!folder) {
        folder = await tx.folders.create({
          data: { studio_id: req.studioId, name: 'Camera — ' + camera.name },
        });
      }
      await tx.folder_items.create({
        data: { folder_id: folder.id, item_type: 'asset', item_id: newAsset.id },
      });

      // Link to assigned album if configured
      if (camera.album_id) {
        const album = await tx.albums.findFirst({
          where: { id: camera.album_id, studio_id: req.studioId },
        });
        if (album) {
          await tx.album_assets.upsert({
            where: {
              album_id_asset_id: {
                album_id: album.id,
                asset_id: newAsset.id,
              },
            },
            create: {
              album_id: album.id,
              asset_id: newAsset.id,
            },
            update: {},
          });
          if (!album.cover_asset_id) {
            await tx.albums.update({
              where: { id: album.id },
              data: { cover_asset_id: newAsset.id },
            });
          }
        }
      }

      await tx.cameras.update({
        where: { id: camera.id },
        data: { last_sync_at: new Date() },
      });

      return newAsset;
    });

    try {
      const { storageEvents } = require('../services/storageWatcher');
      storageEvents.emit('media_change', {
        studio_id: req.studioId,
        camera_id: camera.id,
        asset_id: asset.id,
        album_id: camera.album_id,
      });
    } catch (e) {}

    res.status(201).json({
      success: true,
      asset: {
        id: asset.id,
        filename: asset.filename,
        file_size_bytes: asset.file_size_bytes.toString(),
        mime_type: asset.mime_type,
        created_at: asset.created_at,
        url: `/api/studio/folders/assets/${asset.id}/view`,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function repairGateway(req,res,next){try{
 const password=req.body.password;
 if(typeof password!=='string'||password.length<8||password.length>72)return res.status(400).json({error:'Use a password of 8–72 characters'});
 const camera=await prisma.cameras.findFirst({where:{id:req.params.id,studio_id:req.studioId,lifecycle:{not:'retired'}}});
 if(!camera)return res.status(404).json({error:'Camera not found'});
 const studio=await prisma.studios.findUnique({where:{id:req.studioId},select:{slug:true}});
 try{await sftpgoService.repairCameraUser({username:camera.sftpgo_username,password,studioSlug:studio.slug,cameraId:camera.id,active:camera.is_active});}catch(e){return res.status(502).json({error:'Gateway repair failed. Verify gateway admin access and directory permissions.'});}
 await prisma.cameras.update({where:{id:camera.id},data:{sftpgo_password_hash:await bcrypt.hash(password,12)}});
 res.json({message:'Camera SFTP credentials and upload permissions updated. Set the new password on your camera.'});
}catch(e){next(e);}}
module.exports = {
 repairGateway,
  assignAlbum,
  list,
  create,
  toggleActive,
  retire,
  delete: deleteCamera,
  getCameraAssets,
  uploadCameraPhoto,
};
