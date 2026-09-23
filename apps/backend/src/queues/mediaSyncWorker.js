const { connectRabbitMQ } = require('../config/rabbitmq');
const prisma = require('../config/prisma');
const immichService = require('../services/immichService');

async function handleMediaSyncMessage(payload) {
  if (payload.action === 'index_asset') {
    return indexAsset(payload);
  }

  if (payload.action === 'sftp_upload_detected') {
    return recordSftpUpload(payload);
  }

  if (payload.action === 'bulk_folder_move') {
    return { status: 'queued_for_folder_move', itemCount: payload.itemIds?.length || 0 };
  }

  return { status: 'ignored', action: payload.action };
}

async function indexAsset(payload) {
  const assetId = payload.assetId || payload.asset_id;

  if (!assetId || !payload.studioId) {
    throw new Error('index_asset requires assetId and studioId');
  }

  const queryOptions = {
    where: {
      id: assetId,
      studio_id: payload.studioId,
    },
  };

  const hasExplicitImmichId = Boolean(payload.immichAssetId || payload.immich_asset_id);
  if (hasExplicitImmichId) {
    queryOptions.select = { id: true };
  }

  const asset = await prisma.assets.findFirst(queryOptions);

  if (!asset) {
    throw new Error('Asset not found for studio');
  }

  let immichId = payload.immichAssetId || payload.immich_asset_id || asset.immich_asset_id;

  if (!immichId) {
    const res = await immichService.indexAssetInImmich({
      assetId: asset.id,
      originalPath: asset.original_path,
      mimeType: asset.mime_type,
    });
    immichId = res.immich_asset_id;
  }

  const data = {
    immich_asset_id: immichId,
  };
  if (payload.processing_state) {
    data.processing_state = payload.processing_state;
  }

  return prisma.assets.update({
    where: { id: assetId },
    data,
  });
}

async function recordSftpUpload(payload) {
  const { studioId, filename, originalPath, mimeType, fileSizeBytes = 0, storageProviderId, cameraUsername } = payload;

  if (!studioId || !filename || !originalPath) {
    throw new Error('sftp_upload_detected requires studioId, filename, and originalPath');
  }

  if (storageProviderId) {
    const provider = await prisma.storage_providers.findFirst({
      where: {
        id: storageProviderId,
        studio_id: studioId,
      },
      select: { id: true },
    });

    if (!provider) {
      throw new Error('Storage provider not found for studio');
    }
  }

  const asset = await prisma.assets.create({
    data: {
      studio_id: studioId,
      storage_provider_id: storageProviderId || null,
      filename,
      original_path: originalPath,
      mime_type: mimeType || null,
      file_size_bytes: BigInt(fileSizeBytes || 0),
      processing_state: 'ready',
    },
  });

  if (cameraUsername) {
    await prisma.cameras.updateMany({
      where: {
        studio_id: studioId,
        sftpgo_username: cameraUsername,
      },
      data: { last_sync_at: new Date() },
    });
  }

  return asset;
}

async function startMediaSyncWorker() {
  const { channel } = await connectRabbitMQ();
  if (!channel) return;

  const queue = 'media-sync';
  console.log(`[Worker] Started Media Sync consumer on queue '${queue}'`);

  channel.consume(queue, async (msg) => {
    if (msg !== null) {
      try {
        const payload = JSON.parse(msg.content.toString());
        console.log('[Media Sync Worker] Processing media event:', payload);

        await handleMediaSyncMessage(payload);

        channel.ack(msg);
      } catch (err) {
        console.error('[Media Sync Worker] Error handling message:', err);
        channel.nack(msg, false, false);
      }
    }
  });
}

module.exports = {
  handleMediaSyncMessage,
  startMediaSyncWorker,
};
