const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const prisma = require('../config/prisma');
const env = require('../config/env');

const storageEvents = new EventEmitter();
storageEvents.setMaxListeners(200);

const SUPPORTED_MEDIA_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.cr2', '.cr3', '.arw', '.nef', '.dng',
  '.tif', '.tiff', '.mp4', '.mov',
]);

const pendingFiles = new Map();

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.cr2': 'image/x-canon-cr2',
    '.cr3': 'image/x-canon-cr3',
    '.arw': 'image/x-sony-arw',
    '.nef': 'image/x-nikon-nef',
    '.dng': 'image/x-adobe-dng',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
  };
  return map[ext] || 'application/octet-stream';
}

function getStorageStudiosPath() {
  const candidates = [
    path.resolve(process.cwd(), 'storage/studios'),
    path.resolve(process.cwd(), '../../storage/studios'),
    path.resolve(process.cwd(), '../storage/studios'),
    path.resolve(env.STORAGE_ROOT_PATH || './storage', 'studios'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

async function handleFileAdded(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;

    const ext = path.extname(filePath).toLowerCase();
    if (!SUPPORTED_MEDIA_EXTS.has(ext)) return;

    const rootPath = getStorageStudiosPath();
    const relToRoot = path.relative(rootPath, filePath);
    const parts = relToRoot.split(path.sep);

    if (parts.length < 2) return; // Need a folder directory
    const folderName = parts[0];
    const fileName = path.basename(filePath);

    // Get default / first studio
    const studio = await prisma.studios.findFirst({
      where: { is_active: true },
      orderBy: { created_at: 'asc' },
    });
    if (!studio) return;

    const stat = fs.statSync(filePath);
    if (stat.size === 0) return; // File still being created

    const relToCwd = path.relative(process.cwd(), filePath).replace(/\\/g, '/');

    // 1. Upsert Folder
    let folder = await prisma.folders.findFirst({
      where: { studio_id: studio.id, name: folderName },
    });
    if (!folder) {
      folder = await prisma.folders.create({
        data: {
          studio_id: studio.id,
          name: folderName,
          color: '#3B82F6',
        },
      });
      console.log(`[Storage Watcher] Auto-created folder in DB: ${folder.name}`);
    }

    // 2. Upsert Asset
    let asset = await prisma.assets.findFirst({
      where: { studio_id: studio.id, original_path: relToCwd },
    });
    if (!asset) {
      asset = await prisma.assets.create({
        data: {
          studio_id: studio.id,
          filename: fileName,
          original_path: relToCwd,
          mime_type: getMimeType(fileName),
          file_size_bytes: BigInt(stat.size),
        },
      });
      console.log(`[Storage Watcher] Indexed new camera shot: ${fileName} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    }

    // 3. Link Folder Item
    await prisma.folder_items.upsert({
      where: {
        folder_id_item_type_item_id: {
          folder_id: folder.id,
          item_type: 'asset',
          item_id: asset.id,
        },
      },
      create: {
        folder_id: folder.id,
        item_type: 'asset',
        item_id: asset.id,
      },
      update: {},
    });

    // 4. Auto-Link to Published Album
    const albumTitle = folderName === '2026_09_21'
      ? 'Canon 200D Live Shoot — 2026-09-21'
      : folderName.replace(/_/g, ' ');

    let album = await prisma.albums.findFirst({
      where: { studio_id: studio.id, title: albumTitle },
    });
    if (!album) {
      album = await prisma.albums.create({
        data: {
          studio_id: studio.id,
          title: albumTitle,
          description: 'Live tethered camera collection automatically synced from studio ingest.',
          is_published: true,
        },
      });
    }

    // Link asset to album
    await prisma.album_assets.upsert({
      where: {
        album_id_asset_id: {
          album_id: album.id,
          asset_id: asset.id,
        },
      },
      create: {
        album_id: album.id,
        asset_id: asset.id,
      },
      update: {},
    });

    // Share with studio customers
    const customers = await prisma.customers.findMany({
      where: { studio_id: studio.id },
    });
    for (const cust of customers) {
      await prisma.album_customers.upsert({
        where: {
          album_id_customer_id: {
            album_id: album.id,
            customer_id: cust.id,
          },
        },
        create: {
          album_id: album.id,
          customer_id: cust.id,
          can_download: true,
          can_favorite: true,
        },
        update: {},
      });
    }

    const payload = {
      event: 'new_photo',
      asset: {
        id: asset.id,
        filename: asset.filename,
        mime_type: asset.mime_type,
        file_size_bytes: asset.file_size_bytes.toString(),
        thumbnailUrl: `/api/customer/assets/${asset.id}/view`,
        created_at: asset.created_at,
      },
      folder_id: folder.id,
      folder_name: folder.name,
      album_id: album.id,
      album_title: album.title,
    };

    // Broadcast to SSE listeners
    storageEvents.emit('media_change', payload);
  } catch (err) {
    console.error('[Storage Watcher Error]:', err.message);
  }
}

// Debounce helper to wait for full write completion from camera Wi-Fi / USB
function queueFileForProcessing(fullPath) {
  if (pendingFiles.has(fullPath)) {
    clearTimeout(pendingFiles.get(fullPath));
  }

  const timer = setTimeout(async () => {
    pendingFiles.delete(fullPath);
    await handleFileAdded(fullPath);
  }, 400);

  pendingFiles.set(fullPath, timer);
}

let fsWatcher = null;

function startStorageWatcher() {
  const rootPath = getStorageStudiosPath();
  if (!fs.existsSync(rootPath)) {
    fs.mkdirSync(rootPath, { recursive: true });
  }

  console.log(`[Storage Watcher] Actively monitoring camera storage at: ${rootPath}`);

  try {
    fsWatcher = fs.watch(rootPath, { recursive: true }, (eventType, relativeFilename) => {
      if (!relativeFilename) return;
      const fullPath = path.join(rootPath, relativeFilename);
      const ext = path.extname(relativeFilename).toLowerCase();
      if (SUPPORTED_MEDIA_EXTS.has(ext)) {
        queueFileForProcessing(fullPath);
      }
    });

    fsWatcher.on('error', (err) => {
      console.warn('[Storage Watcher] FS watch note:', err.message);
    });
  } catch (err) {
    console.warn('[Storage Watcher] Could not attach recursive watch:', err.message);
  }
}

module.exports = {
  storageEvents,
  startStorageWatcher,
};
