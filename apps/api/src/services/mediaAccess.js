const path = require('path');
const fs = require('fs/promises');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { storageEvents } = require('./storageWatcher');

function albumAccessWhere(userId) {
  return { is_published: true, studio: { is_active: true }, album_customers: { some: { customer: { user_id: userId } } } };
}

async function deliverAsset(asset, req, res) {
  if (asset.is_soft_deleted) return res.status(404).json({ error: 'Media not found' });
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', asset.mime_type || 'application/octet-stream');
  if (req.query.download === 'true') {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(asset.filename)}"`);
  } else {
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(asset.filename)}"`);
  }
  if (asset.storage_provider_id && asset.object_key) {
    const { readObject } = require('./storageAdapters');
    const provider = await prisma.storage_providers.findFirst({ where: { id: asset.storage_provider_id, studio_id: asset.studio_id }, include: { storage_credentials: true } });
    if (!provider) return res.status(404).json({ error: 'Media not found' });
    const stream = await readObject(provider, asset.object_key);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    return stream.pipe(res);
  }
  // Legacy originals must resolve inside the configured storage root, including symlinks.
  const root = await fs.realpath(path.resolve(env.STORAGE_ROOT_PATH));
  const candidates = [path.resolve(process.cwd(), asset.original_path), path.resolve(process.cwd(), '../../', asset.original_path)];
  for (const candidate of candidates) {
    const real = await fs.realpath(candidate).catch(() => null);
    if (!real) continue;
    const rel = path.relative(root, real);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) continue;
    return res.sendFile(real);
  }
  return res.status(404).json({ error: 'Media not found' });
}

async function privateLiveStream(req, res, next) {
  try {
    const albumId = req.query.album_id;
    if (typeof albumId !== 'string') return res.status(400).json({ error: 'album_id required' });
    const allowed = () => prisma.albums.findFirst({ where: { id: albumId, ...albumAccessWhere(req.user.id) }, select: { id: true, studio_id: true } });
    const album = await allowed();
    if (!album) return res.status(404).json({ error: 'Gallery not found' });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'private, no-store');
    res.flushHeaders();
    const listener = async payload => {
      if (payload.studio_id !== album.studio_id || payload.album_id !== album.id) return;
      try { if (await allowed()) res.write('data: {"event":"refresh"}\n\n'); else res.end(); } catch { res.end(); }
    };
    const heartbeat = setInterval(async () => { try { if (await allowed()) res.write(': heartbeat\n\n'); else res.end(); } catch { res.end(); } }, 10000);
    storageEvents.on('media_change', listener);
    res.on('close', () => { clearInterval(heartbeat); storageEvents.removeListener('media_change', listener); });
  } catch (error) { next(error); }
}
module.exports = { albumAccessWhere, deliverAsset, privateLiveStream };
