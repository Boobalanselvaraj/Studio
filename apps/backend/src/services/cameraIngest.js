const fs=require('fs');
const fsp=require('fs/promises');
const path=require('path');
const crypto=require('crypto');
const prisma=require('../config/prisma');
const env=require('../config/env');
const {writeObject}=require('./storageAdapters');
const types={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.cr3':'image/x-canon-cr3','.cr2':'image/x-canon-cr2','.nef':'image/x-nikon-nef','.arw':'image/x-sony-arw','.dng':'image/x-adobe-dng','.mp4':'video/mp4','.mov':'video/quicktime'};
function sanitizePathSegment(str, fallback = 'general') {
  if (!str) return fallback;
  const cleaned = String(str)
    .trim()
    .replace(/[<>:"/\\|?*()\[\]\x00-\x1F#%&{}\\<>*?/$!'":@+`|=]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '');
  return cleaned || fallback;
}

function cameraRoot(camera) {
  const slug = camera.studio?.slug || 'studio';
  const directPath = path.resolve(env.STORAGE_ROOT_PATH, slug, 'cameras', camera.sftpgo_username);
  const studiosPath = path.resolve(env.STORAGE_ROOT_PATH, 'studios', slug, 'cameras', camera.sftpgo_username);
  if (fs.existsSync(directPath)) return directPath;
  if (fs.existsSync(studiosPath)) return studiosPath;
  return directPath;
}

async function ingest(camera, relative) {
  const rootDir = cameraRoot(camera);
  await fsp.mkdir(rootDir, { recursive: true });
  const root = await fsp.realpath(rootDir);
  const file = await fsp.realpath(path.resolve(root, relative));
  const rel = path.relative(root, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Upload path outside camera directory');
  const mime = types[path.extname(file).toLowerCase()];
  if (!mime) throw new Error('Unsupported photo or video format');
  const stat = await fsp.stat(file);
  if (!stat.isFile() || !stat.size) throw new Error('Upload is empty or incomplete');
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  const digest = hash.digest('hex');
  const source = 'camera:' + camera.id + ':' + crypto.createHash('sha256').update(rel + digest).digest('hex');
  if (await prisma.billing_events.findUnique({ where: { source_key: source } })) return { status: 'duplicate_event_ignored' };

  // Fetch latest camera metadata to catch dynamically assigned albums
  const freshCamera = await prisma.cameras.findUnique({
    where: { id: camera.id },
    select: { album_id: true, name: true, sftpgo_username: true, storage_provider_id: true },
  });
  const effectiveAlbumId = freshCamera?.album_id || camera.album_id;
  const effectiveStorageProviderId = freshCamera?.storage_provider_id || camera.storage_provider_id;

  // Optional: transfer to studio-owned external storage provider
  // No provider = file indexed from local SFTP landing zone (no platform storage used)
  const provider = effectiveStorageProviderId
    ? await prisma.storage_providers.findFirst({
        where: { id: effectiveStorageProviderId, studio_id: camera.studio_id, is_enabled: true, backend: { in: ['sftp', 'ftp', 's3', 'local'] } },
        include: { storage_credentials: true },
      })
    : null;

  if (!provider) throw new Error('Camera requires an enabled external storage connection; upload retained for retry');

  // ============================================================================
  // Meaningful, Well-Organized Storage Hierarchy:
  // Root: [Studio Slug or Name]
  // Subfolder: If assigned to Album -> Albums/[Album-Title]
  //            If unassigned -> Cameras/[Camera-Name]/[YYYY-MM-DD]
  // Filename: [SafeFilename].[ext] (all photos sit together in one folder!)
  // ============================================================================
  let studioSlug = camera.studio?.slug;
  if (!studioSlug && camera.studio_id) {
    const s = await prisma.studios.findUnique({
      where: { id: camera.studio_id },
      select: { slug: true, name: true },
    });
    studioSlug = s?.slug || sanitizePathSegment(s?.name, 'studio');
  }
  const studioFolder = sanitizePathSegment(studioSlug || 'studio');

  let folderCategory = '';
  if (effectiveAlbumId) {
    const album = await prisma.albums.findFirst({
      where: { id: effectiveAlbumId, studio_id: camera.studio_id },
      select: { id: true, title: true },
    });
    if (album && album.title) {
      folderCategory = `Albums/${sanitizePathSegment(album.title, 'Album-' + album.id.slice(0, 8))}`;
    }
  }

  if (!folderCategory) {
    const cameraFolder = sanitizePathSegment(camera.name || freshCamera?.name || camera.sftpgo_username, 'Camera-' + camera.id.slice(0, 8));
    const shootDate = new Date().toISOString().slice(0, 10);
    folderCategory = `Cameras/${cameraFolder}/${shootDate}`;
  }

  const rawBasename = path.basename(file);
  const ext = path.extname(rawBasename).toLowerCase();
  const rawStem = path.basename(rawBasename, path.extname(rawBasename));
  const safeStem = sanitizePathSegment(rawStem, 'photo');
  const safeFilename = `${safeStem}${ext}`;

  let objectKey = `${studioFolder}/${folderCategory}/${safeFilename}`;

  // Collision handling: if a different photo already has this name in this folder,
  // append a short 6-character hash suffix to the file name so no folders are spawned.
  const existingAsset = await prisma.assets.findFirst({
    where: {
      studio_id: camera.studio_id,
      object_key: objectKey,
    },
    select: { id: true },
  });

  if (existingAsset) {
    objectKey = `${studioFolder}/${folderCategory}/${safeStem}_${digest.slice(0, 6)}${ext}`;
  }

  let storageProviderId = null;

  if (provider) {
    // Transfer to studio-owned storage (SFTP/S3/FTP/Local)
    await writeObject(provider, objectKey, fs.createReadStream(file), mime);
    const after = await fsp.stat(file);
    if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) throw new Error('Upload changed during transfer; retrying');
    storageProviderId = provider.id;
  }

  const asset = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', camera.studio_id);
    if (await tx.billing_events.findUnique({ where: { source_key: source } })) return null;
    const a = await tx.assets.create({
      data: {
        studio_id: camera.studio_id,
        camera_id: camera.id,
        storage_provider_id: storageProviderId,
        filename: path.basename(objectKey),
        original_path: objectKey,
        object_key: objectKey,
        mime_type: mime,
        file_size_bytes: BigInt(stat.size),
        processing_state: 'ready',
      },
    });
    let folder = await tx.folders.findFirst({ where: { studio_id: camera.studio_id, name: 'Camera — ' + (camera.name || 'Main'), parent_folder_id: null } });
    if (!folder) folder = await tx.folders.create({ data: { studio_id: camera.studio_id, name: 'Camera — ' + (camera.name || 'Main') } });
    await tx.folder_items.create({ data: { folder_id: folder.id, item_type: 'asset', item_id: a.id } });
    await tx.billing_events.create({ data: { studio_id: camera.studio_id, source_key: source, meter: 'camera_ingest', quantity: 0 } });
    if (effectiveAlbumId) {
      const album = await tx.albums.findFirst({ where: { id: effectiveAlbumId, studio_id: camera.studio_id } });
      if (album) {
        await tx.album_assets.upsert({ where: { album_id_asset_id: { album_id: album.id, asset_id: a.id } }, create: { album_id: album.id, asset_id: a.id }, update: {} });
        if (!album.cover_asset_id) await tx.albums.update({ where: { id: album.id }, data: { cover_asset_id: a.id } });
      }
    }
    await tx.cameras.update({ where: { id: camera.id }, data: { last_sync_at: new Date() } });
    return a;
  }, { timeout: 15000 });

  // Zero platform storage consumption: delete temporary local buffer once transferred to external storage
  if (provider && storageProviderId && asset) {
    await fsp.unlink(file).catch(() => {});
  }

  if (asset) require('./storageWatcher').storageEvents.emit('media_change', { studio_id: camera.studio_id, camera_id: camera.id, asset_id: asset.id, album_id: effectiveAlbumId });
  return { status: asset ? 'accepted' : 'duplicate_event_ignored', asset_id: asset?.id };
}

module.exports = { ingest, cameraRoot, types, sanitizePathSegment };
