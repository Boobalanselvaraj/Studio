const prisma = require('../config/prisma');

async function listAlbums(req, res, next) {
  try {
    const albumsList = await prisma.albums.findMany({
      where: { studio_id: req.studioId },
      include: {
        event: {
          select: { id: true, title: true },
        },
        album_assets: {
          where: {asset:{is_soft_deleted:false}},
          include: {
            asset: true,
          },
          orderBy: { sort_order: 'asc' },
        },
        album_customers: {
          include: {
            customer: {
              include: {
                user: { select: { id: true, full_name: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    res.json(albumsList);
  } catch (err) {
    next(err);
  }
}

async function createAlbum(req, res, next) {
  try {
    const { title, description, event_id, is_published = false, asset_ids = [] } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Album title is required' });
    }

    if (event_id) {
      const event = await prisma.events.findFirst({
        where: { id: event_id, studio_id: req.studioId },
      });
      if (!event) {
        return res.status(400).json({ error: 'Selected event not found' });
      }
    }

    const album = await prisma.$transaction(async (tx) => {
      const created = await tx.albums.create({
        data: {
          studio_id: req.studioId,
          event_id: event_id || null,
          title: title.trim(),
          description: description ? description.trim() : null,
          is_published: Boolean(is_published),
        },
      });

      if (Array.isArray(asset_ids) && asset_ids.length > 0) {
        // Verify assets belong to studio
        const validAssets = await tx.assets.findMany({
          where: { id: { in: asset_ids }, studio_id: req.studioId, is_soft_deleted:false },
          select: { id: true },
        });

        if (validAssets.length > 0) {
          await tx.album_assets.createMany({
            data: validAssets.map((a, idx) => ({
              album_id: created.id,
              asset_id: a.id,
              sort_order: idx,
            })),
            skipDuplicates: true,
          });

          // Set cover asset
          await tx.albums.update({
            where: { id: created.id },
            data: { cover_asset_id: validAssets[0].id },
          });
        }
      }

      return created;
    });

    res.status(201).json(album);
  } catch (err) {
    next(err);
  }
}

async function getAlbumById(req, res, next) {
  try {
    const album = await prisma.albums.findFirst({
      where: { id: req.params.id, studio_id: req.studioId },
      include: {
        event: { select: { id: true, title: true } },
        album_assets: {
          where: {asset:{is_soft_deleted:false}},
          include: { asset: true },
          orderBy: { sort_order: 'asc' },
        },
        album_customers: {
          include: {
            customer: {
              include: {
                user: { select: { id: true, full_name: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    res.json(album);
  } catch (err) {
    next(err);
  }
}

async function updateAlbum(req, res, next) {
  try {
    const { id } = req.params;
    const { title, description, cover_asset_id, is_published } = req.body;

    const existing = await prisma.albums.findFirst({
      where: { id, studio_id: req.studioId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Album not found' });
    }

    if(cover_asset_id) {
      const cover=await prisma.album_assets.findFirst({where:{album_id:id,asset_id:cover_asset_id}});
      if(!cover)return res.status(400).json({error:'Cover must be a photo in this album'});
    }
    const updated = await prisma.albums.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        description: description !== undefined ? (description ? description.trim() : null) : undefined,
        cover_asset_id: cover_asset_id !== undefined ? cover_asset_id : undefined,
        is_published: is_published !== undefined ? Boolean(is_published) : undefined,
        updated_at: new Date(),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteAlbum(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.albums.findFirst({
      where: { id, studio_id: req.studioId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Album not found' });
    }

    await prisma.albums.delete({ where: { id } });

    res.json({ message: 'Album deleted successfully' });
  } catch (err) {
    next(err);
  }
}

async function addAssetsToAlbum(req, res, next) {
  try {
    const { id } = req.params;
    const { asset_ids } = req.body;

    if (!Array.isArray(asset_ids) || asset_ids.length === 0) {
      return res.status(400).json({ error: 'asset_ids array is required' });
    }

    const album = await prisma.albums.findFirst({
      where: { id, studio_id: req.studioId },
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const validAssets = await prisma.assets.findMany({
      where: { id: { in: asset_ids }, studio_id: req.studioId },
      select: { id: true },
    });

    const highestSort = await prisma.album_assets.findFirst({
      where: { album_id: id },
      orderBy: { sort_order: 'desc' },
      select: { sort_order: true },
    });
    let startOrder = highestSort ? highestSort.sort_order + 1 : 0;

    await prisma.album_assets.createMany({
      data: validAssets.map((a, idx) => ({
        album_id: id,
        asset_id: a.id,
        sort_order: startOrder + idx,
      })),
      skipDuplicates: true,
    });

    if (!album.cover_asset_id && validAssets.length > 0) {
      await prisma.albums.update({
        where: { id },
        data: { cover_asset_id: validAssets[0].id },
      });
    }

    res.json({ message: `Added ${validAssets.length} assets to album` });
  } catch (err) {
    next(err);
  }
}

async function removeAssetFromAlbum(req, res, next) {
  try {
    const { id, assetId } = req.params;

    await prisma.album_assets.deleteMany({
      where: {
        album_id: id,
        asset_id: assetId,
        album: { studio_id: req.studioId },
      },
    });

    res.json({ message: 'Asset removed from album' });
  } catch (err) {
    next(err);
  }
}

async function downloadAlbumZip(req, res, next) {
  try {
    const { id } = req.params;
    const favoritesOnly = req.query.favorites === 'true' || req.query.favorites === '1';

    const album = await prisma.albums.findFirst({
      where: { id, studio_id: req.studioId },
      include: {
        album_assets: {
          where: favoritesOnly ? { is_favorite: true } : undefined,
          include: { asset: true },
        },
      },
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    if (favoritesOnly && (!album.album_assets || album.album_assets.length === 0)) {
      return res.status(400).json({ error: 'No client favorite photos to export in this album' });
    }

    const archiver = require('archiver');
    const path = require('path');
    const zip = archiver('zip', { zlib: { level: 5 } });

    const zipSuffix = favoritesOnly ? 'favorites' : 'full';
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${album.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${zipSuffix}.zip"`);

    zip.on('error', error => res.destroy(error));
    res.on('close', () => zip.abort());
    zip.pipe(res);

    for (const item of album.album_assets) {
      if (item.asset && !item.asset.is_soft_deleted) {
        if (item.asset.storage_provider_id && item.asset.object_key) {
          const provider = await prisma.storage_providers.findFirst({
            where: { id: item.asset.storage_provider_id, studio_id: req.studioId },
            include: { storage_credentials: true },
          });
          if (provider) {
            try {
              const stream = await require('../services/storageAdapters').readObject(provider, item.asset.object_key);
              stream.on('error', error => zip.destroy(error));
              zip.append(stream, { name: item.asset.id + '_' + path.basename(item.asset.filename) });
              continue;
            } catch (err) {
              console.warn('[studio downloadAlbumZip] error reading remote object:', err);
            }
          }
        }
        if (item.asset.original_path) {
          const fs = require('fs');
          const p = path.resolve(process.cwd(), item.asset.original_path);
          if (fs.existsSync(p)) {
            zip.file(p, { name: item.asset.id + '_' + path.basename(item.asset.filename) });
          }
        }
      }
    }

    await zip.finalize();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAlbums,
  createAlbum,
  getAlbumById,
  updateAlbum,
  deleteAlbum,
  addAssetsToAlbum,
  removeAssetFromAlbum,
  downloadAlbumZip,
};
