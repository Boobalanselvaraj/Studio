const path = require('path');
const fs = require('fs');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { deliverAsset } = require('../services/mediaAccess');
const { publishToQueue } = require('../config/rabbitmq');
const { deleteObject, deleteDirectory } = require('../services/storageAdapters');

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
          is_soft_deleted: false,
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
    res.status(409).json({ error: 'Use an assigned camera upload profile. Unmapped folders cannot be imported safely.' });
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
        is_soft_deleted: false,
        studio_id: req.studioId,
      },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    return await deliverAsset(asset, req, res);
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

    const descendantIds=await getDescendantFolderIds(folder.id,req.studioId);
    const nestedItems=await prisma.folder_items.findMany({where:{folder_id:{in:[folder.id,...descendantIds]},item_type:'asset'}});
    const validAssets=await prisma.assets.findMany({where:{id:{in:nestedItems.map(item=>item.item_id)},studio_id:req.studioId,is_soft_deleted:false},select:{id:true}});
    folder.folder_items=validAssets.map(asset=>({item_id:asset.id}));
    // Link folder and descendant assets
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
    const deleteFiles = req.query.delete_files === 'true' || req.body?.delete_files === true;

    const folder = await prisma.folders.findFirst({
      where: { id: folderId, studio_id: req.studioId },
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const descendantIds = await getDescendantFolderIds(folderId, req.studioId);
    const allFolderIds = [folderId, ...descendantIds];

    if (deleteFiles) {
      const items = await prisma.folder_items.findMany({
        where: { folder_id: { in: allFolderIds }, item_type: 'asset' },
        select: { item_id: true },
      });
      const assetIds = [...new Set(items.map((i) => i.item_id))];
      if (assetIds.length > 0) {
        const assets = await prisma.assets.findMany({
          where: { id: { in: assetIds }, studio_id: req.studioId },
        });
        for (const asset of assets) {
          await deletePhysicalAsset(asset);
        }
        await cleanupAssetsFromDb(assetIds, req.studioId);
      }
    }

    if (descendantIds.length > 0) {
      await prisma.folders.deleteMany({
        where: { id: { in: descendantIds }, studio_id: req.studioId },
      });
    }

    await prisma.folders.delete({
      where: { id: folderId },
    });

    res.json({ message: 'Folder deleted successfully', id: folderId });
  } catch (err) {
    next(err);
  }
}


async function getServerExplorerData(req, res, next) {
  try {
    const [assets, providers, cameras, albums, customers, folders] = await Promise.all([
      prisma.assets.findMany({
        where: {
          studio_id: req.studioId,
          is_soft_deleted: false,
        },
        include: {
          storage_provider: { select: { id: true, name: true, backend: true } },
          album_assets: {
            include: {
              album: { select: { id: true, title: true, is_published: true } },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      prisma.storage_providers.findMany({
        where: { studio_id: req.studioId },
        select: { id: true, name: true, backend: true, is_default: true, health: true },
      }),
      prisma.cameras.findMany({
        where: { studio_id: req.studioId, lifecycle: { not: 'retired' } },
        select: { id: true, name: true, model: true, is_active: true, last_sync_at: true },
      }),
      prisma.albums.findMany({
        where: { studio_id: req.studioId },
        select: { id: true, title: true, is_published: true },
      }),
      prisma.customers.findMany({
        where: { studio_id: req.studioId },
        include: { user: { select: { id: true, full_name: true, email: true } } },
      }),
      prisma.folders.findMany({
        where: { studio_id: req.studioId },
        include: { folder_items: true },
        orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const camerasMap = new Map((cameras || []).map((c) => [c.id, { id: c.id, name: c.name, model: c.model }]));

    const assetFoldersMap = new Map();
    (folders || []).forEach((f) => {
      (f.folder_items || []).forEach((fi) => {
        if (fi.item_type === 'asset') {
          if (!assetFoldersMap.has(fi.item_id)) assetFoldersMap.set(fi.item_id, []);
          assetFoldersMap.get(fi.item_id).push({ id: f.id, name: f.name });
        }
      });
    });

    const formattedAssets = assets.map((a) => ({
      id: a.id,
      filename: a.filename,
      mime_type: a.mime_type,
      file_size_bytes: a.file_size_bytes ? a.file_size_bytes.toString() : '0',
      created_at: a.created_at,
      original_path: a.original_path,
      object_key: a.object_key || a.original_path,
      url: `/api/studio/folders/assets/${a.id}/view`,
      camera: a.camera_id ? (camerasMap.get(a.camera_id) || null) : null,
      storage_provider: a.storage_provider || null,
      albums: a.album_assets.map((aa) => aa.album),
      folders: assetFoldersMap.get(a.id) || [],
    }));

    res.json({
      assets: formattedAssets,
      providers,
      cameras,
      albums,
      folders,
      customers: customers.map((c) => ({
        id: c.id,
        name: c.user?.full_name || 'Customer',
        email: c.user?.email || '',
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function batchAssignAssets(req, res, next) {
  try {
    const { asset_ids, album_id, customer_id, new_album_title } = req.body;
    if (!Array.isArray(asset_ids) || asset_ids.length === 0) {
      return res.status(400).json({ error: 'asset_ids array is required' });
    }

    const uniqueIds = [...new Set(asset_ids)];
    const validAssets = await prisma.assets.count({where:{id:{in:uniqueIds},studio_id:req.studioId,is_soft_deleted:false}});
    if(validAssets !== uniqueIds.length) return res.status(400).json({error:'One or more files do not belong to this studio'});
    if(album_id && !await prisma.albums.findFirst({where:{id:album_id,studio_id:req.studioId}})) return res.status(404).json({error:'Album not found'});
    if(customer_id && !await prisma.customers.findFirst({where:{id:customer_id,studio_id:req.studioId}})) return res.status(404).json({error:'Customer not found'});
    if(!album_id && !new_album_title?.trim()) return res.status(400).json({error:'Choose an album or enter a new album title'});
    let targetAlbumId = album_id;
    if (!targetAlbumId && new_album_title && new_album_title.trim()) {
      const newAlbum = await prisma.albums.create({
        data: {
          studio_id: req.studioId,
          title: new_album_title.trim(),
          is_published: true,
        },
      });
      targetAlbumId = newAlbum.id;
    }

    if (targetAlbumId) {
      for (let i = 0; i < asset_ids.length; i++) {
        await prisma.album_assets.upsert({
          where: {
            album_id_asset_id: {
              album_id: targetAlbumId,
              asset_id: asset_ids[i],
            },
          },
          create: {
            album_id: targetAlbumId,
            asset_id: asset_ids[i],
            sort_order: i,
          },
          update: {},
        });
      }
    }

    if (customer_id && targetAlbumId) {
      await prisma.album_customers.upsert({
        where: {
          album_id_customer_id: {
            album_id: targetAlbumId,
            customer_id,
          },
        },
        create: {
          album_id: targetAlbumId,
          customer_id,
          can_download: true,
          can_favorite: true,
        },
        update: {},
      });
    }

    res.json({ success: true, message: `Assigned ${asset_ids.length} files successfully.` });
  } catch (err) {
    next(err);
  }
}

async function updateAsset(req,res,next){try{
 const {filename}=req.body;
 if(typeof filename!=='string'||!filename.trim()||filename.length>255||/[\\/\x00-\x1f]/.test(filename))return res.status(400).json({error:'Enter a valid filename without path separators'});
 const asset=await prisma.assets.findFirst({where:{id:req.params.id,studio_id:req.studioId,is_soft_deleted:false}});
 if(!asset)return res.status(404).json({error:'File not found'});
 if(path.extname(filename).toLowerCase()!==path.extname(asset.filename).toLowerCase())return res.status(400).json({error:'Keep the original file extension when renaming'});
 const updated=await prisma.assets.update({where:{id:asset.id},data:{filename:filename.trim()}});res.json(updated);
}catch(e){next(e);}}
async function deletePhysicalAsset(asset) {
  let deleted = false;
  if (!asset) return false;

  // 1. Delete from remote storage provider if configured
  if (asset.storage_provider_id) {
    try {
      const provider = await prisma.storage_providers.findFirst({
        where: { id: asset.storage_provider_id },
        include: { storage_credentials: true },
      });
      if (provider) {
        const key = asset.object_key || asset.original_path;
        if (key) {
          await deleteObject(provider, key);
          deleted = true;
        }
      }
    } catch (err) {
      console.warn(`[Storage] Remote deletion warning for asset ${asset.id}:`, err.message);
    }
  }

  // 2. Also physically unlink any local file if present
  const root = env.STORAGE_ROOT_PATH ? path.resolve(env.STORAGE_ROOT_PATH) : path.resolve(process.cwd(), './storage');
  const candidates = [
    asset.original_path ? path.resolve(process.cwd(), asset.original_path) : null,
    asset.original_path ? path.resolve(process.cwd(), '../../', asset.original_path) : null,
    asset.original_path ? path.resolve(root, asset.original_path.replace(/^[/\\]+/, '')) : null,
    asset.object_key ? path.resolve(root, asset.object_key.replace(/^[/\\]+/, '')) : null,
  ].filter(Boolean);

  for (const cand of candidates) {
    try {
      if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
        fs.unlinkSync(cand);
        deleted = true;
      }
    } catch (_) {}
  }

  return deleted;
}

async function cleanupAssetsFromDb(assetIds, studioId) {
  if (!assetIds || assetIds.length === 0) return;

  // 1. Clean folder_items
  await prisma.folder_items.deleteMany({
    where: { item_id: { in: assetIds }, item_type: 'asset' },
  }).catch(() => {});

  // 2. Clear album cover references
  await prisma.albums.updateMany({
    where: { cover_asset_id: { in: assetIds } },
    data: { cover_asset_id: null },
  }).catch(() => {});

  // 3. Clear album_assets
  await prisma.album_assets.deleteMany({
    where: { asset_id: { in: assetIds } },
  }).catch(() => {});

  // 4. Clear asset_tags
  await prisma.asset_tags.deleteMany({
    where: { asset_id: { in: assetIds } },
  }).catch(() => {});

  // 5. Delete asset records
  await prisma.assets.deleteMany({
    where: { id: { in: assetIds }, studio_id: studioId },
  }).catch(() => {});
}

async function deleteAsset(req, res, next) {
  try {
    const asset = await prisma.assets.findFirst({
      where: { id: req.params.id, studio_id: req.studioId },
    });
    if (!asset) return res.status(404).json({ error: 'File not found' });

    await deletePhysicalAsset(asset);
    await cleanupAssetsFromDb([asset.id], req.studioId);

    res.json({
      success: true,
      message: `File '${asset.filename}' permanently deleted from storage server and studio library.`,
    });
  } catch (e) {
    next(e);
  }
}

async function bulkDeleteAssets(req, res, next) {
  try {
    const { asset_ids } = req.body;
    if (!Array.isArray(asset_ids) || !asset_ids.length) {
      return res.status(400).json({ error: 'Select files to delete' });
    }

    const uniqueIds = [...new Set(asset_ids)];
    const assets = await prisma.assets.findMany({
      where: { id: { in: uniqueIds }, studio_id: req.studioId },
    });

    if (!assets.length) {
      return res.status(404).json({ error: 'No matching files found to delete' });
    }

    let storageDeletedCount = 0;
    for (const a of assets) {
      const removed = await deletePhysicalAsset(a);
      if (removed) storageDeletedCount++;
    }

    await cleanupAssetsFromDb(assets.map((a) => a.id), req.studioId);

    res.json({
      success: true,
      message: `Permanently deleted ${assets.length} file(s) from storage server and studio library.`,
      count: assets.length,
      storage_deleted_count: storageDeletedCount,
    });
  } catch (e) {
    next(e);
  }
}

async function deleteProviderFolder(req, res, next) {
  try {
    const { provider_id, folder_path } = req.body;
    if (!folder_path || typeof folder_path !== 'string') {
      return res.status(400).json({ error: 'folder_path is required' });
    }

    const cleanPath = folder_path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!cleanPath) {
      return res.status(400).json({ error: 'Cannot delete root storage directory' });
    }

    let provider = null;
    if (provider_id && provider_id !== 'local') {
      provider = await prisma.storage_providers.findFirst({
        where: { id: provider_id, studio_id: req.studioId },
        include: { storage_credentials: true },
      });
      if (!provider) {
        return res.status(404).json({ error: 'Storage provider not found' });
      }
    } else {
      provider = await prisma.storage_providers.findFirst({
        where: { studio_id: req.studioId, backend: 'local' },
        include: { storage_credentials: true },
      }) || { backend: 'local', studio_id: req.studioId };
    }

    // Find all assets in DB within this folder path
    const candidateAssets = await prisma.assets.findMany({
      where: {
        studio_id: req.studioId,
        ...(provider.id ? { storage_provider_id: provider.id } : {}),
      },
    });

    const matchingAssets = candidateAssets.filter((a) => {
      const p = (a.object_key || a.original_path || '').replace(/\\/g, '/');
      return p.includes(cleanPath);
    });

    for (const a of matchingAssets) {
      await deletePhysicalAsset(a);
    }

    if (matchingAssets.length > 0) {
      await cleanupAssetsFromDb(matchingAssets.map((a) => a.id), req.studioId);
    }

    // Recursively delete directory on remote storage server
    try {
      await deleteDirectory(provider, cleanPath);
    } catch (dirErr) {
      console.warn(`[deleteProviderFolder] deleteDirectory warning for ${cleanPath}:`, dirErr.message);
    }

    res.json({
      success: true,
      message: `Folder '${cleanPath}' and all files permanently removed from storage server.`,
      deleted_files_count: matchingAssets.length,
    });
  } catch (e) {
    next(e);
  }
}

async function addFolderAssets(req,res,next){try{
 const folder=await prisma.folders.findFirst({where:{id:req.params.id,studio_id:req.studioId}});
 if(!folder)return res.status(404).json({error:'Folder not found'});
 if(!Array.isArray(req.body.asset_ids)||!req.body.asset_ids.length)return res.status(400).json({error:'Select files to add'});
 const ids=[...new Set(req.body.asset_ids)];
 const count=await prisma.assets.count({where:{id:{in:ids},studio_id:req.studioId,is_soft_deleted:false}});
 if(count!==ids.length)return res.status(400).json({error:'Some files are not available in this studio'});
 await prisma.folder_items.createMany({data:ids.map(id=>({folder_id:folder.id,item_type:'asset',item_id:id})),skipDuplicates:true});res.json({message:'Files added to collection'});
}catch(e){next(e);}}
module.exports = {
 updateAsset,
 deleteAsset,
 bulkDeleteAssets,
 deleteProviderFolder,
 addFolderAssets,
  getTree,
  getServerExplorerData,
  batchAssignAssets,
  syncStorage,
  serveAsset,
  publishGallery,
  create,
  update,
  move,
  bulkMove,
  delete: deleteFolder,
};

