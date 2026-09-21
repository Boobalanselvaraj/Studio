const path = require('path');
const fs = require('fs');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { publishToQueue } = require('../config/rabbitmq');

const SUPPORTED_MEDIA_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.cr2', '.cr3', '.arw', '.nef', '.dng',
  '.tif', '.tiff', '.mp4', '.mov',
]);

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

async function scanStudioStorage(studioId) {
  try {
    const rootPath = getStorageStudiosPath();
    if (!fs.existsSync(rootPath)) {
      return { foldersCount: 0, assetsCount: 0 };
    }

    const entries = fs.readdirSync(rootPath, { withFileTypes: true });
    let totalAssets = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const folderName = entry.name;
        const folderFullPath = path.join(rootPath, folderName);

        // Upsert Folder
        let folder = await prisma.folders.findFirst({
          where: { studio_id: studioId, name: folderName, parent_folder_id: null },
        });

        if (!folder) {
          folder = await prisma.folders.create({
            data: {
              studio_id: studioId,
              name: folderName,
              color: '#3B82F6',
            },
          });
        }

        // Scan files inside folder
        const files = fs.readdirSync(folderFullPath, { withFileTypes: true });
        for (const file of files) {
          if (file.isFile()) {
            const ext = path.extname(file.name).toLowerCase();
            if (SUPPORTED_MEDIA_EXTS.has(ext)) {
              const fileFullPath = path.join(folderFullPath, file.name);
              const stat = fs.statSync(fileFullPath);
              const relPath = path.relative(process.cwd(), fileFullPath).replace(/\\/g, '/');

              let asset = await prisma.assets.findFirst({
                where: { studio_id: studioId, original_path: relPath },
              });

              if (!asset) {
                asset = await prisma.assets.create({
                  data: {
                    studio_id: studioId,
                    filename: file.name,
                    original_path: relPath,
                    mime_type: getMimeType(file.name),
                    file_size_bytes: BigInt(stat.size),
                  },
                });
              }

              // Ensure folder item relation
              const existingLink = await prisma.folder_items.findFirst({
                where: {
                  folder_id: folder.id,
                  item_type: 'asset',
                  item_id: asset.id,
                },
              });

              if (!existingLink) {
                await prisma.folder_items.create({
                  data: {
                    folder_id: folder.id,
                    item_type: 'asset',
                    item_id: asset.id,
                  },
                });
              }

              totalAssets++;
            }
          }
        }
      }
    }

    return { foldersCount: entries.filter((e) => e.isDirectory()).length, assetsCount: totalAssets };
  } catch (err) {
    console.warn('[Storage Scan Error]:', err.message);
    return { error: err.message };
  }
}

function buildHierarchy(folders, parentId = null) {
  return folders
    .filter((f) => f.parent_folder_id === parentId)
    .map((folder) => ({
      ...folder,
      children: buildHierarchy(folders, folder.id),
    }));
}

async function getTree(req, res, next) {
  try {
    // Run auto storage scan so new camera shots appear immediately
    await scanStudioStorage(req.studioId);

    const flatFolders = await prisma.folders.findMany({
      where: { studio_id: req.studioId },
      include: {
        folder_items: {
          orderBy: { sort_order: 'asc' },
        },
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });

    // Enrich folders with their actual asset objects
    const allAssetItemIds = flatFolders
      .flatMap((f) => f.folder_items)
      .filter((it) => it.item_type === 'asset')
      .map((it) => it.item_id);

    let assetsMap = {};
    if (allAssetItemIds.length > 0) {
      const assets = await prisma.assets.findMany({
        where: {
          id: { in: allAssetItemIds },
          studio_id: req.studioId,
        },
        select: {
          id: true,
          filename: true,
          mime_type: true,
          file_size_bytes: true,
          created_at: true,
          original_path: true,
        },
      });

      assetsMap = Object.fromEntries(
        assets.map((a) => [
          a.id,
          {
            ...a,
            file_size_bytes: a.file_size_bytes ? a.file_size_bytes.toString() : '0',
            url: `/api/studio/folders/assets/${a.id}/view`,
          },
        ])
      );
    }

    const enrichedFolders = flatFolders.map((f) => {
      const folderAssets = f.folder_items
        .filter((it) => it.item_type === 'asset' && assetsMap[it.item_id])
        .map((it) => assetsMap[it.item_id]);

      return {
        ...f,
        assets: folderAssets,
        items_count: folderAssets.length,
      };
    });

    const tree = buildHierarchy(enrichedFolders, null);
    res.json(tree);
  } catch (err) {
    next(err);
  }
}

async function syncStorage(req, res, next) {
  try {
    const result = await scanStudioStorage(req.studioId);
    res.json({
      message: 'Studio storage successfully scanned and indexed',
      ...result,
    });
  } catch (err) {
    next(err);
  }
}

async function serveAsset(req, res, next) {
  try {
    const assetId = req.params.id;
    const asset = await prisma.assets.findFirst({
      where: {
        id: assetId,
        studio_id: req.studioId,
      },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    let filePath = path.resolve(process.cwd(), asset.original_path);
    if (!fs.existsSync(filePath)) {
      // Try root workspace path
      filePath = path.resolve(process.cwd(), '../../', asset.original_path);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Physical media file missing from disk' });
    }

    res.setHeader('Content-Type', asset.mime_type || getMimeType(asset.filename));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { parent_folder_id, name, sort_order = 0, icon, color, naming_template } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    if (parent_folder_id) {
      const parent = await prisma.folders.findFirst({
        where: { id: parent_folder_id, studio_id: req.studioId },
      });
      if (!parent) {
        return res.status(404).json({ error: 'Parent folder not found in this studio' });
      }
    }

    const folder = await prisma.folders.create({
      data: {
        studio_id: req.studioId,
        parent_folder_id: parent_folder_id || null,
        name,
        sort_order,
        icon,
        color,
        naming_template,
      },
    });

    res.status(201).json(folder);
  } catch (err) {
    next(err);
  }
}

async function move(req, res, next) {
  try {
    const { target_parent_id } = req.body;
    const folderId = req.params.id;

    if (target_parent_id === folderId) {
      return res.status(400).json({ error: 'Folder cannot be its own parent' });
    }

    const folder = await prisma.folders.findFirst({
      where: { id: folderId, studio_id: req.studioId },
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    if (target_parent_id) {
      const targetParent = await prisma.folders.findFirst({
        where: { id: target_parent_id, studio_id: req.studioId },
      });

      if (!targetParent) {
        return res.status(404).json({ error: 'Target parent folder not found' });
      }

      const descendantIds = await getDescendantFolderIds(folderId, req.studioId);
      if (descendantIds.includes(target_parent_id)) {
        return res.status(400).json({ error: 'Folder cannot be moved inside one of its descendants' });
      }
    }

    const updated = await prisma.folders.update({
      where: { id: folderId },
      data: {
        parent_folder_id: target_parent_id || null,
        updated_at: new Date(),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function getDescendantFolderIds(folderId, studioId) {
  const descendants = [];
  let currentParentIds = [folderId];

  while (currentParentIds.length > 0) {
    const children = await prisma.folders.findMany({
      where: {
        studio_id: studioId,
        parent_folder_id: { in: currentParentIds },
      },
      select: { id: true },
    });

    currentParentIds = children.map((child) => child.id);
    descendants.push(...currentParentIds);
  }

  return descendants;
}

async function bulkMove(req, res, next) {
  try {
    const { item_ids, target_folder_id } = req.body;

    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ error: 'item_ids must be a non-empty array' });
    }

    const target = await prisma.folders.findFirst({
      where: { id: target_folder_id, studio_id: req.studioId },
    });

    if (!target) {
      return res.status(404).json({ error: 'Target destination folder not found' });
    }

    const items = await prisma.folder_items.findMany({
      where: {
        id: { in: item_ids },
        folder: {
          studio_id: req.studioId,
        },
      },
      select: { id: true },
    });

    if (items.length !== item_ids.length) {
      return res.status(400).json({ error: 'One or more folder items do not belong to this studio' });
    }

    await publishToQueue('media-sync', {
      action: 'bulk_folder_move',
      studioId: req.studioId,
      itemIds: item_ids,
      targetFolderId: target_folder_id,
      requestedBy: req.user ? req.user.id : null,
    });

    res.status(202).json({
      status: 'queued',
      message: `Queued bulk move of ${item_ids.length} item(s) to folder '${target.name}'`,
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const folderId = req.params.id;
    const { name, sort_order, icon, color, naming_template } = req.body;

    const folder = await prisma.folders.findFirst({
      where: { id: folderId, studio_id: req.studioId },
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const updated = await prisma.folders.update({
      where: { id: folderId },
      data: {
        name: name !== undefined ? name : undefined,
        sort_order: sort_order !== undefined ? sort_order : undefined,
        icon: icon !== undefined ? icon : undefined,
        color: color !== undefined ? color : undefined,
        naming_template: naming_template !== undefined ? naming_template : undefined,
        updated_at: new Date(),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function publishGallery(req, res, next) {
  try {
    const folderId = req.params.id;
    const { title, description } = req.body;

    const folder = await prisma.folders.findFirst({
      where: { id: folderId, studio_id: req.studioId },
      include: {
        folder_items: {
          where: { item_type: 'asset' },
        },
      },
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const albumTitle = title || folder.name.replace(/_/g, ' ');

    let album = await prisma.albums.findFirst({
      where: { studio_id: req.studioId, title: albumTitle },
    });

    if (!album) {
      album = await prisma.albums.create({
        data: {
          studio_id: req.studioId,
          title: albumTitle,
          description: description || `Client gallery collection from folder '${folder.name}'`,
          is_published: true,
        },
      });
    } else {
      await prisma.albums.update({
        where: { id: album.id },
        data: { is_published: true },
      });
    }

    // Link folder assets
    for (let i = 0; i < folder.folder_items.length; i++) {
      const item = folder.folder_items[i];
      await prisma.album_assets.upsert({
        where: {
          album_id_asset_id: {
            album_id: album.id,
            asset_id: item.item_id,
          },
        },
        create: {
          album_id: album.id,
          asset_id: item.item_id,
          sort_order: i,
        },
        update: {
          sort_order: i,
        },
      });
    }

    // Link to all studio customers so they can view it in their portal
    const customers = await prisma.customers.findMany({
      where: { studio_id: req.studioId },
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
        update: {
          can_download: true,
          can_favorite: true,
        },
      });
    }

    res.json({
      message: `Folder '${folder.name}' published as Client Gallery successfully!`,
      album_id: album.id,
      title: album.title,
      photos_count: folder.folder_items.length,
    });
  } catch (err) {
    next(err);
  }
}

async function deleteFolder(req, res, next) {
  try {
    const folderId = req.params.id;

    const folder = await prisma.folders.findFirst({
      where: { id: folderId, studio_id: req.studioId },
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    await prisma.folders.delete({
      where: { id: folderId },
    });

    res.json({ message: 'Folder deleted successfully', id: folderId });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTree,
  syncStorage,
  serveAsset,
  publishGallery,
  create,
  update,
  move,
  bulkMove,
  delete: deleteFolder,
};
