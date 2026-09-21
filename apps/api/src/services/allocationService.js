const prisma = require('../config/prisma');

const GIB_BYTES = BigInt(1073741824); // 1 GiB = 1,073,741,824 bytes

/**
 * Checks camera slot allocation for a studio
 */
async function checkCameraLimit(studioId, client = prisma) {
  if (!client.studio_billing_profile?.findUnique || !client.cameras?.count) {
    return { allowed: true, reserved: 0, limit: 10, remaining: 10 };
  }

  const profile = await client.studio_billing_profile.findUnique({
    where: { studio_id: studioId },
    select: { camera_limit: true },
  });

  const limit = profile && profile.camera_limit !== undefined ? profile.camera_limit : 5;

  const reservedCount = await client.cameras.count({
    where: {
      studio_id: studioId,
      lifecycle: { not: 'retired' },
    },
  });

  return {
    allowed: reservedCount < limit,
    reserved: reservedCount,
    limit,
    remaining: Math.max(0, limit - reservedCount),
  };
}

/**
 * Checks platform storage quota before reserving/committing bytes
 */
async function checkStorageQuota(studioId, incomingBytes = 0, client = prisma) {
  if (!client.studio_billing_profile?.findUnique) {
    return { allowed: true, committedBytes: BigInt(0), reservedBytes: BigInt(0), totalUsedBytes: BigInt(0), quotaBytes: BigInt(0), quotaGb: 50, remainingBytes: BigInt(0) };
  }

  const profile = await client.studio_billing_profile.findUnique({
    where: { studio_id: studioId },
    select: { storage_quota_gb: true },
  });

  const quotaGb = profile ? Number(profile.storage_quota_gb) : 0;
  const quotaBytes = BigInt(Math.floor(quotaGb * Number(GIB_BYTES)));

  let committedPlatformBytes = BigInt(0);
  if (client.assets?.aggregate) {
    const platformAssetsAgg = await client.assets.aggregate({
      where: {
        studio_id: studioId,
        is_soft_deleted: false,
        OR: [
          { storage_provider_id: null },
          { storage_provider: { provider_type: 'platform' } },
        ],
      },
      _sum: { file_size_bytes: true },
    });
    if (platformAssetsAgg?._sum?.file_size_bytes) {
      committedPlatformBytes = BigInt(platformAssetsAgg._sum.file_size_bytes);
    }
  }

  let reservedBytes = BigInt(0);
  if (client.upload_sessions?.aggregate) {
    const activeSessionsAgg = await client.upload_sessions.aggregate({
      where: {
        studio_id: studioId,
        status: 'reserved',
        expires_at: { gt: new Date() },
      },
      _sum: { expected_bytes: true },
    });
    if (activeSessionsAgg?._sum?.expected_bytes) {
      reservedBytes = BigInt(activeSessionsAgg._sum.expected_bytes);
    }
  }

  const totalUsedBytes = committedPlatformBytes + reservedBytes;
  const requiredTotal = totalUsedBytes + BigInt(incomingBytes);

  return {
    allowed: quotaBytes > BigInt(0) && requiredTotal <= quotaBytes,
    committedBytes: committedPlatformBytes,
    reservedBytes,
    totalUsedBytes,
    quotaBytes,
    quotaGb,
    remainingBytes: quotaBytes > totalUsedBytes ? quotaBytes - totalUsedBytes : BigInt(0),
  };
}

/**
 * Returns comprehensive usage breakdown separating platform billable storage
 * from studio-owned storage (SFTP, S3, FTP) and per-camera breakdown.
 */
async function getStudioUsage(studioId, client = prisma) {
  if (!client.studio_billing_profile?.findUnique) {
    return {
      studioId,
      platform: { quotaGb: 50, quotaBytes: '53687091200', usedBytes: '0', usedGb: 0, reservedBytes: '0', remainingBytes: '53687091200', percentUsed: 0, isApproachingQuota: false, isExceeded: false, assetCount: 0 },
      studioOwned: { usedBytes: '0', usedGb: 0, assetCount: 0, notice: 'Storage paid directly to your provider. Incurs no platform storage fee.' },
      cameras: { limit: 5, reserved: 0, remaining: 5, list: [] },
      billingStatus: 'active',
      plan: 'Starter',
    };
  }

  const profile = await client.studio_billing_profile.findUnique({
    where: { studio_id: studioId },
    include: { billing_plan: true },
  });

  const quotaGb = profile ? Number(profile.storage_quota_gb) : 0;
  const quotaBytes = BigInt(Math.floor(quotaGb * Number(GIB_BYTES)));
  const cameraLimit = profile && profile.camera_limit !== undefined ? profile.camera_limit : 5;

  let platformBytes = BigInt(0);
  let platformCount = 0;
  if (client.assets?.aggregate) {
    const platformAgg = await client.assets.aggregate({
      where: {
        studio_id: studioId,
        is_soft_deleted: false,
        OR: [
          { storage_provider_id: null },
          { storage_provider: { provider_type: 'platform' } },
        ],
      },
      _sum: { file_size_bytes: true },
      _count: { id: true },
    });
    if (platformAgg?._sum?.file_size_bytes) {
      platformBytes = BigInt(platformAgg._sum.file_size_bytes);
    }
    platformCount = platformAgg?._count?.id || 0;
  }

  let reservedBytes = BigInt(0);
  if (client.upload_sessions?.aggregate) {
    const reservationsAgg = await client.upload_sessions.aggregate({
      where: {
        studio_id: studioId,
        status: 'reserved',
        expires_at: { gt: new Date() },
      },
      _sum: { expected_bytes: true },
    });
    if (reservationsAgg?._sum?.expected_bytes) {
      reservedBytes = BigInt(reservationsAgg._sum.expected_bytes);
    }
  }

  let studioOwnedBytes = BigInt(0);
  let studioOwnedCount = 0;
  if (client.assets?.aggregate) {
    const studioOwnedAgg = await client.assets.aggregate({
      where: {
        studio_id: studioId,
        is_soft_deleted: false,
        storage_provider: { provider_type: 'studio_owned' },
      },
      _sum: { file_size_bytes: true },
      _count: { id: true },
    });
    if (studioOwnedAgg?._sum?.file_size_bytes) {
      studioOwnedBytes = BigInt(studioOwnedAgg._sum.file_size_bytes);
    }
    studioOwnedCount = studioOwnedAgg?._count?.id || 0;
  }

  let cameras = [];
  if (client.cameras?.findMany) {
    cameras = await client.cameras.findMany({
      where: { studio_id: studioId },
      select: { id: true, name: true, model: true, lifecycle: true, is_active: true },
    });
  }

  const cameraUsageList = await Promise.all(
    cameras.map(async (cam) => {
      let bytes = 0;
      let count = 0;
      if (client.assets?.aggregate) {
        const agg = await client.assets.aggregate({
          where: {
            studio_id: studioId,
            camera_id: cam.id,
            is_soft_deleted: false,
          },
          _sum: { file_size_bytes: true },
          _count: { id: true },
        });
        bytes = agg?._sum?.file_size_bytes ? Number(agg._sum.file_size_bytes) : 0;
        count = agg?._count?.id || 0;
      }
      return {
        id: cam.id,
        name: cam.name,
        model: cam.model,
        lifecycle: cam.lifecycle,
        bytes,
        photosCount: count,
      };
    })
  );

  let legacyBytes = 0;
  let legacyCount = 0;
  if (client.assets?.aggregate) {
    const legacyAgg = await client.assets.aggregate({
      where: {
        studio_id: studioId,
        camera_id: null,
        is_soft_deleted: false,
      },
      _sum: { file_size_bytes: true },
      _count: { id: true },
    });
    legacyBytes = legacyAgg?._sum?.file_size_bytes ? Number(legacyAgg._sum.file_size_bytes) : 0;
    legacyCount = legacyAgg?._count?.id || 0;
  }

  cameraUsageList.push({
    id: 'legacy_unassigned',
    name: 'Unassigned Legacy Uploads',
    model: 'System Legacy',
    lifecycle: 'archived',
    bytes: legacyBytes,
    photosCount: legacyCount,
  });

  const usedBytesNum = Number(platformBytes);
  const quotaBytesNum = Number(quotaBytes);
  const usedGb = (usedBytesNum / Number(GIB_BYTES)).toFixed(2);
  const percentUsed = quotaBytesNum > 0 ? ((usedBytesNum / quotaBytesNum) * 100).toFixed(1) : '0';

  const nonRetiredCameras = cameras.filter((c) => c.lifecycle !== 'retired').length;

  return {
    studioId,
    platform: {
      quotaGb,
      quotaBytes: quotaBytes.toString(),
      usedBytes: platformBytes.toString(),
      usedGb: parseFloat(usedGb),
      reservedBytes: reservedBytes.toString(),
      remainingBytes: (quotaBytes > platformBytes ? quotaBytes - platformBytes : BigInt(0)).toString(),
      percentUsed: parseFloat(percentUsed),
      isApproachingQuota: parseFloat(percentUsed) >= 80,
      isExceeded: parseFloat(percentUsed) >= 100,
      assetCount: platformCount,
    },
    studioOwned: {
      usedBytes: studioOwnedBytes.toString(),
      usedGb: parseFloat((Number(studioOwnedBytes) / Number(GIB_BYTES)).toFixed(2)),
      assetCount: studioOwnedCount,
      notice: 'Storage paid directly to your provider. Incurs no platform storage fee.',
    },
    cameras: {
      limit: cameraLimit,
      reserved: nonRetiredCameras,
      remaining: Math.max(0, cameraLimit - nonRetiredCameras),
      list: cameraUsageList,
    },
    billingStatus: profile?.billing_status || 'active',
    plan: profile?.billing_plan?.name || 'Custom Plan',
  };
}

module.exports = {
  GIB_BYTES,
  checkCameraLimit,
  checkStorageQuota,
  getStudioUsage,
};
