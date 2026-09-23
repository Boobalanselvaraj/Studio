const crypto = require('crypto');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { deliverAsset } = require('../services/mediaAccess');
const { storageEvents } = require('../services/storageWatcher');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// -------------------------------------------------------------
// STUDIO MANAGEMENT OF SHARES
// -------------------------------------------------------------
async function createShare(req, res, next) {
  try {
    const { album_id, album_ids, expires_in_hours, expires_at: customExpiresAt, operation_key } = req.body;

    const targetAlbumIds = Array.isArray(album_ids)
      ? album_ids
      : album_id
      ? [album_id]
      : [];

    if (targetAlbumIds.length === 0) {
      return res.status(400).json({ error: 'At least one published album_id is required' });
    }

    // Verify albums belong to studio and are published
    const albums = await prisma.albums.findMany({
      where: {
        id: { in: targetAlbumIds },
        studio_id: req.studioId,
        is_published: true,
      },
      select: { id: true, title: true },
    });

    if (albums.length === 0) {
      return res.status(404).json({ error: 'No published albums found matching the request' });
    }

    const verifiedAlbumIds = albums.map((a) => a.id);

    // Expiry calculation: finite positive duration or future date
    let expiresAt;
    if (customExpiresAt) {
      expiresAt = new Date(customExpiresAt);
      if (isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
        return res.status(400).json({ error: 'expires_at must be a valid future date/time' });
      }
    } else {
      const hours = Number(expires_in_hours) || 72; // default 3 days
      if (hours <= 0 || !Number.isFinite(hours)) {
        return res.status(400).json({ error: 'expires_in_hours must be a positive number' });
      }
      expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    }

    const opKey = operation_key || `share_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Idempotent retry check
    const existing = await prisma.share_links.findFirst({
      where: { studio_id: req.studioId, operation_key: opKey },
    });
    if (existing && !existing.revoked_at && existing.expires_at > new Date()) {
      return res.status(200).json(existing);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    const share = await prisma.share_links.create({
      data: {
        studio_id: req.studioId,
        album_ids: verifiedAlbumIds,
        token_hash: tokenHash,
        expires_at: expiresAt,
        created_by: req.user.id,
        operation_key: opKey,
      },
    });

    const shareUrl = `${env.APP_URL}/shared/${rawToken}`;

    res.status(201).json({
      id: share.id,
      share_url: shareUrl,
      token: rawToken,
      expires_at: share.expires_at,
      album_ids: verifiedAlbumIds,
      created_at: share.created_at,
    });
  } catch (err) {
    next(err);
  }
}

async function listShares(req, res, next) {
  try {
    const { album_id } = req.query;

    const shares = await prisma.share_links.findMany({
      where: {
        studio_id: req.studioId,
      },
      orderBy: { created_at: 'desc' },
    });

    const filtered = album_id
      ? shares.filter((s) => Array.isArray(s.album_ids) && s.album_ids.includes(album_id))
      : shares;

    res.json(
      filtered.map((s) => ({
        id: s.id,
        album_ids: s.album_ids,
        expires_at: s.expires_at,
        revoked_at: s.revoked_at,
        is_active: !s.revoked_at && new Date() < new Date(s.expires_at),
        created_at: s.created_at,
      }))
    );
  } catch (err) {
    next(err);
  }
}

async function revokeShare(req, res, next) {
  try {
    const shareId = req.params.id;
    const share = await prisma.share_links.findFirst({
      where: { id: shareId, studio_id: req.studioId },
    });

    if (!share) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    await prisma.share_links.update({
      where: { id: shareId },
      data: { revoked_at: new Date() },
    });

    res.json({ message: 'Public share link revoked successfully' });
  } catch (err) {
    next(err);
  }
}

// -------------------------------------------------------------
// PUBLIC ACCESS (Independent view-only, bearer token)
// -------------------------------------------------------------
async function getPublicShare(req, res, next) {
  try {
    const token = req.params.token;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token required' });
    }

    const tokenHash = hashToken(token);
    const share = await prisma.share_links.findUnique({
      where: { token_hash: tokenHash },
    });

    if (!share || share.revoked_at || new Date() >= new Date(share.expires_at)) {
      return res.status(404).json({ error: 'This gallery link is invalid, expired, or has been revoked.' });
    }

    const albumIds = Array.isArray(share.album_ids) ? share.album_ids : [];

    const albums = await prisma.albums.findMany({
      where: {
        id: { in: albumIds },
        studio_id: share.studio_id,
        is_published: true,
        studio: { is_active: true },
      },
      include: {
        studio: {
          select: { name: true, studio_branding: true },
        },
        album_assets: {
          include: { asset: true },
        },
      },
    });

    if (albums.length === 0) {
      return res.status(404).json({ error: 'No media currently available in this shared gallery.' });
    }

    const formatted = albums.map((alb) => {
      const validAssets = (alb.album_assets || [])
        .filter((aa) => aa.asset && !aa.asset.is_soft_deleted)
        .map((aa) => ({
          id: aa.asset.id,
          filename: aa.asset.filename,
          mime_type: aa.asset.mime_type,
          file_size_bytes: aa.asset.file_size_bytes.toString(),
          thumbnailUrl: `/api/public/shares/${token}/assets/${aa.asset.id}/view`,
          downloadUrl: `/api/public/shares/${token}/assets/${aa.asset.id}/view?download=true`,
          created_at: aa.asset.created_at,
        }));

      return {
        id: alb.id,
        title: alb.title,
        description: alb.description,
        cover_image_url: alb.cover_image_url,
        photosCount: validAssets.length,
        assets: validAssets,
      };
    });

    res.json({
      studio_name: albums[0]?.studio?.name,
      branding: albums[0]?.studio?.studio_branding?.[0] || null,
      expires_at: share.expires_at,
      albums: formatted,
    });
  } catch (err) {
    next(err);
  }
}

async function servePublicAsset(req, res, next) {
  try {
    const { token, id: assetId } = req.params;
    if (!token || !assetId) {
      return res.status(400).json({ error: 'Token and asset ID required' });
    }

    const tokenHash = hashToken(token);
    const share = await prisma.share_links.findUnique({
      where: { token_hash: tokenHash },
    });

    if (!share || share.revoked_at || new Date() >= new Date(share.expires_at)) {
      return res.status(404).json({ error: 'Media not found or link expired' });
    }

    const albumIds = Array.isArray(share.album_ids) ? share.album_ids : [];

    // Authorize asset is part of an album in this share and not soft deleted
    const asset = await prisma.assets.findFirst({
      where: {
        id: assetId,
        studio_id: share.studio_id,
        is_soft_deleted: false,
        album_assets: {
          some: {
            album_id: { in: albumIds },
            album: { is_published: true, studio: { is_active: true } },
          },
        },
      },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Media not found' });
    }

    return await deliverAsset(asset, req, res);
  } catch (err) {
    next(err);
  }
}

async function publicLiveStream(req, res, next) {
  try {
    const token = req.params.token;
    const tokenHash = hashToken(token);

    const isShareValid = async () => {
      const s = await prisma.share_links.findUnique({
        where: { token_hash: tokenHash },
        select: { id: true, studio_id: true, album_ids: true, expires_at: true, revoked_at: true },
      });
      if (!s || s.revoked_at || new Date() >= new Date(s.expires_at)) return null;
      return s;
    };

    const share = await isShareValid();
    if (!share) {
      return res.status(404).json({ error: 'Gallery link expired or invalid' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const listener = async (payload) => {
      const activeShare = await isShareValid();
      if (!activeShare) {
        res.end();
        return;
      }
      const albumIds = Array.isArray(activeShare.album_ids) ? activeShare.album_ids : [];
      if (payload.studio_id === activeShare.studio_id && albumIds.includes(payload.album_id)) {
        res.write('data: {"event":"refresh"}\n\n');
      }
    };

    const heartbeat = setInterval(async () => {
      try {
        const activeShare = await isShareValid();
        if (activeShare) {
          res.write(': heartbeat\n\n');
        } else {
          clearInterval(heartbeat);
          res.end();
        }
      } catch {
        clearInterval(heartbeat);
        res.end();
      }
    }, 10000);

    storageEvents.on('media_change', listener);

    req.on('close', () => {
      clearInterval(heartbeat);
      storageEvents.removeListener('media_change', listener);
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createShare,
  listShares,
  revokeShare,
  getPublicShare,
  servePublicAsset,
  publicLiveStream,
};
