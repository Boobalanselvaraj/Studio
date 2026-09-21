const prisma = require('../config/prisma');
const env = require('../config/env');
const { checkStorageQuota } = require('../services/allocationService');
const { storageEvents } = require('../services/storageWatcher');

async function handleIngestEvent(req, res, next) {
  try {
    // 1. Authenticate internal caller
    const internalSecret = env.INTERNAL_SERVICE_KEY || env.JWT_SECRET;
    const authHeader = req.headers['x-internal-token'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!authHeader || authHeader !== internalSecret) {
      return res.status(401).json({ error: 'Unauthorized internal service request' });
    }

    const {
      username,
      filename,
      virtual_path,
      file_size = 0,
      checksum,
      event_id,
      mime_type = 'image/jpeg',
    } = req.body;

    if (!username || !filename) {
      return res.status(400).json({ error: 'username and filename are required' });
    }

    // 2. Replay protection using event_id if supplied
    if (event_id) {
      const existingEvent = await prisma.billing_events.findFirst({
        where: { source_key: `gateway_${event_id}` },
      });
      if (existingEvent) {
        return res.status(200).json({ status: 'duplicate_event_ignored', event_id });
      }
    }

    // 3. Server-side tenant & camera derivation from upload identity (never trust client-supplied studio ID)
    const camera = await prisma.cameras.findFirst({
      where: {
        OR: [
          { upload_username: username },
          { sftpgo_username: username },
        ],
        lifecycle: { not: 'retired' },
      },
      include: {
        storage_provider: true,
      },
    });

    if (!camera) {
      return res.status(403).json({ error: 'No active camera found for the provided upload identity' });
    }

    const studioId = camera.studio_id;
    const fileBytes = BigInt(file_size || 0);

    // 4. If platform-managed storage, verify storage quota
    const isPlatform = !camera.storage_provider || camera.storage_provider.provider_type === 'platform';
    if (isPlatform && fileBytes > 0n) {
      const quotaCheck = await checkStorageQuota(studioId, fileBytes);
      if (!quotaCheck.allowed) {
        return res.status(403).json({
          error: 'Platform storage quota exceeded for this studio.',
          code: 'STORAGE_QUOTA_EXCEEDED',
          quotaGb: quotaCheck.quotaGb,
          remainingBytes: quotaCheck.remainingBytes.toString(),
        });
      }
    }

    // 5. Idempotent asset creation
    const filePath = virtual_path || `/${username}/${filename}`;
    let asset = await prisma.assets.findFirst({
      where: {
        studio_id: studioId,
        filename,
        original_path: filePath,
        is_soft_deleted: false,
      },
    });

    if (!asset) {
      asset = await prisma.assets.create({
        data: {
          studio_id: studioId,
          camera_id: camera.id,
          storage_provider_id: camera.storage_provider_id || null,
          filename,
          original_path: filePath,
          mime_type,
          file_size_bytes: fileBytes,
          checksum: checksum || null,
          processing_state: 'ready',
        },
      });

      // Settle billing event if platform storage
      if (isPlatform && fileBytes > 0n && event_id) {
        await prisma.billing_events.create({
          data: {
            studio_id: studioId,
            source_key: `gateway_${event_id}`,
            meter: 'platform_storage_bytes',
            quantity: Number(fileBytes),
          },
        }).catch(() => {});
      }

      // Update camera sync timestamp
      await prisma.cameras.update({
        where: { id: camera.id },
        data: { last_sync_at: new Date() },
      }).catch(() => {});

      // Scoped live update broadcast
      storageEvents.emit('media_change', {
        studio_id: studioId,
        camera_id: camera.id,
        asset_id: asset.id,
      });
    }

    return res.status(200).json({
      status: 'accepted',
      asset_id: asset.id,
      studio_id: studioId,
      camera_id: camera.id,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  handleIngestEvent,
};
