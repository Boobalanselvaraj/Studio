const crypto = require('crypto');
const path = require('path');
const prisma = require('../config/prisma');
const { checkStorageQuota } = require('../services/allocationService');
const { writeObject } = require('../services/storageAdapters');
const { storageEvents } = require('../services/storageWatcher');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// -------------------------------------------------------------
// PROFILE MANAGEMENT (Studio Admin)
// -------------------------------------------------------------
async function createProfile(req, res, next) {
  try {
    const { camera_id, album_id, name, expires_in_days = 30 } = req.body;

    if (!camera_id || !name) {
      return res.status(400).json({ error: 'camera_id and name are required' });
    }

    // Verify camera belongs to same studio and is not retired
    const camera = await prisma.cameras.findFirst({
      where: { id: camera_id, studio_id: req.studioId },
    });
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found in this studio' });
    }
    if (camera.lifecycle === 'retired') {
      return res.status(400).json({ error: 'Cannot create an upload profile for a retired camera' });
    }

    // If album_id provided, verify same-studio
    if (album_id) {
      const album = await prisma.albums.findFirst({
        where: { id: album_id, studio_id: req.studioId },
      });
      if (!album) {
        return res.status(404).json({ error: 'Album not found in this studio' });
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000);

    const profile = await prisma.upload_profiles.create({
      data: {
        studio_id: req.studioId,
        camera_id,
        album_id: album_id || null,
        name: name.trim(),
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    res.status(201).json({
      id: profile.id,
      studio_id: profile.studio_id,
      camera_id: profile.camera_id,
      album_id: profile.album_id,
      name: profile.name,
      upload_token: rawToken, // Shown once upon creation
      expires_at: profile.expires_at,
      created_at: profile.created_at,
    });
  } catch (err) {
    next(err);
  }
}

async function listProfiles(req, res, next) {
  try {
    const profiles = await prisma.upload_profiles.findMany({
      where: { studio_id: req.studioId },
      orderBy: { created_at: 'desc' },
    });

    res.json(
      profiles.map((p) => ({
        id: p.id,
        studio_id: p.studio_id,
        camera_id: p.camera_id,
        album_id: p.album_id,
        name: p.name,
        expires_at: p.expires_at,
        revoked_at: p.revoked_at,
        created_at: p.created_at,
      }))
    );
  } catch (err) {
    next(err);
  }
}

async function revokeProfile(req, res, next) {
  try {
    const profileId = req.params.id;
    const profile = await prisma.upload_profiles.findFirst({
      where: { id: profileId, studio_id: req.studioId },
    });
    if (!profile) {
      return res.status(404).json({ error: 'Upload profile not found' });
    }

    await prisma.upload_profiles.update({
      where: { id: profileId },
      data: { revoked_at: new Date() },
    });

    res.json({ message: 'Upload profile revoked successfully' });
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------
// AUTH MIDDLEWARE FOR UPLOADS
// -------------------------------------------------------------
async function authenticateUploader(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const tokenHeader = req.headers['x-upload-token'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (tokenHeader) {
      token = tokenHeader.trim();
    }

    // Check if authenticated as regular studio user first
    if (req.user && req.studioId) {
      return next();
    }

    if (!token) {
      return res.status(401).json({ error: 'Upload authorization token required' });
    }

    const tokenHash = hashToken(token);
    const profile = await prisma.upload_profiles.findUnique({
      where: { token_hash: tokenHash },
    });

    if (!profile) {
      return res.status(401).json({ error: 'Invalid upload credentials' });
    }

    if (profile.revoked_at) {
      return res.status(403).json({ error: 'Upload profile has been revoked' });
    }

    if (new Date() > profile.expires_at) {
      return res.status(403).json({ error: 'Upload profile has expired' });
    }

    req.uploadProfile = profile;
    req.studioId = profile.studio_id;
    next();
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------
// UPLOAD SESSIONS & INGESTION
// -------------------------------------------------------------
async function createUploadSession(req, res, next) {
  try {
    const {
      filename,
      mime_type = 'application/octet-stream',
      expected_bytes,
      idempotency_key,
      camera_id: explicitCameraId,
      album_id: explicitAlbumId,
    } = req.body;

    if (!filename || !expected_bytes || !idempotency_key) {
      return res.status(400).json({ error: 'filename, expected_bytes, and idempotency_key are required' });
    }

    const cameraId = req.uploadProfile?.camera_id || explicitCameraId;
    const albumId = req.uploadProfile?.album_id || explicitAlbumId || null;
    const profileId = req.uploadProfile?.id || null;

    if (!cameraId) {
      return res.status(400).json({ error: 'camera_id is required' });
    }

    // Find camera and its configured storage provider
    const camera = await prisma.cameras.findFirst({
      where: { id: cameraId, studio_id: req.studioId },
      include: { storage_provider: true },
    });

    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }

    if (camera.lifecycle === 'retired') {
      return res.status(403).json({ error: 'Camera is retired. Ingest not permitted.' });
    }

    let storageProviderId = camera.storage_provider_id;
    let storageProvider = camera.storage_provider;

    if (!storageProviderId || !storageProvider) {
      // Use studio default
      storageProvider = await prisma.storage_providers.findFirst({
        where: { studio_id: req.studioId, is_enabled: true },
        orderBy: [{ is_default: 'desc' }, { created_at: 'asc' }],
      });
      if (!storageProvider) {
        return res.status(409).json({ error: 'No active storage destination configured for this studio' });
      }
      storageProviderId = storageProvider.id;
    }

    // Idempotency check: if session already exists for this profile and key
    if (profileId) {
      const existingSession = await prisma.upload_sessions.findUnique({
        where: {
          profile_id_idempotency_key: {
            profile_id: profileId,
            idempotency_key,
          },
        },
      });
      if (existingSession) {
        return res.status(200).json(existingSession);
      }
    }

    const bytesNum = BigInt(expected_bytes);


    const objectKey = `studios/${req.studioId}/${cameraId}/${Date.now()}_${path.basename(filename)}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1-hour reservation lease

    const session = await prisma.upload_sessions.create({
      data: {
        studio_id: req.studioId,
        camera_id: cameraId,
        profile_id: profileId || cameraId, // fallback to camera ID if no separate profile
        storage_provider_id: storageProviderId,
        album_id: albumId,
        idempotency_key,
        filename: path.basename(filename),
        mime_type,
        expected_bytes: bytesNum,
        object_key: objectKey,
        status: 'reserved',
        expires_at: expiresAt,
      },
    });

    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
}

async function uploadFileStream(req, res, next) {
  try {
    const sessionId = req.params.sessionId;

    const session = await prisma.upload_sessions.findFirst({
      where: { id: sessionId, studio_id: req.studioId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Upload session not found' });
    }

    if (session.status === 'committed') {
      return res.status(200).json({ message: 'Upload session already completed' });
    }

    if (new Date() > session.expires_at) {
      return res.status(410).json({ error: 'Upload session has expired' });
    }

    const provider = await prisma.storage_providers.findFirst({
      where: { id: session.storage_provider_id },
      include: { storage_credentials: true },
    });

    if (!provider) {
      return res.status(500).json({ error: 'Configured destination storage unavailable' });
    }

    // Stream directly into storage adapter
    const writeResult = await writeObject(provider, session.object_key, req, session.mime_type);

    const actualSize = BigInt(writeResult.bytesWritten || session.expected_bytes);

    // Commit asset & settle upload session atomically
    const asset = await prisma.$transaction(async (tx) => {
      await tx.upload_sessions.update({
        where: { id: session.id },
        data: {
          status: 'committed',
          committed_at: new Date(),
        },
      });

      const newAsset = await tx.assets.create({
        data: {
          studio_id: session.studioId,
          camera_id: session.camera_id,
          storage_provider_id: session.storage_provider_id,
          upload_session_id: session.id,
          filename: session.filename,
          original_path: session.object_key,
          object_key: session.object_key,
          mime_type: session.mime_type,
          file_size_bytes: actualSize,
          processing_state: 'ready',
        },
      });

      // Update camera last_sync_at
      await tx.cameras.update({
        where: { id: session.camera_id },
        data: { last_sync_at: new Date() },
      });

      // Optional Album Association
      if (session.album_id) {
        await tx.album_assets.upsert({
          where: {
            album_id_asset_id: {
              album_id: session.album_id,
              asset_id: newAsset.id,
            },
          },
          create: {
            album_id: session.album_id,
            asset_id: newAsset.id,
          },
          update: {},
        });
      }

      // Billing Event: Record committed storage or WiFi event
      await tx.billing_events.create({
        data: {
          studio_id: session.studioId,
          source_key: `upload_${session.id}`,
          meter: 'studio_owned_upload',
          quantity: actualSize.toString(),
        },
      });

      return newAsset;
    });

    // Scoped live event for this specific studio and album
    if (session.album_id) {
      storageEvents.emit('media_change', {
        studio_id: session.studioId,
        album_id: session.album_id,
        event: 'new_photo',
        asset: {
          id: asset.id,
          filename: asset.filename,
          mime_type: asset.mime_type,
          file_size_bytes: asset.file_size_bytes.toString(),
          thumbnailUrl: `/api/customer/assets/${asset.id}/view`,
          created_at: asset.created_at,
        },
      });
    }

    res.status(201).json({
      message: 'Upload committed successfully',
      asset_id: asset.id,
      filename: asset.filename,
      file_size_bytes: asset.file_size_bytes.toString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createProfile,
  listProfiles,
  revokeProfile,
  authenticateUploader,
  createUploadSession,
  uploadFileStream,
};
