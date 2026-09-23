const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const env = require('../config/env');
const { albumAccessWhere, deliverAsset } = require('../services/mediaAccess');

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

async function listStudioCustomers(req, res, next) {
  try {
    const customers = await prisma.customers.findMany({
      where: { studio_id: req.studioId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
            phone: true,
          },
        },
        event_customers: {
          include: {
            event: {
              select: {
                id: true,
                title: true,
                status: true,
                event_date_start: true,
                albums: {
                  select: {
                    id: true,
                    title: true,
                    _count: { select: { album_assets: true } },
                  },
                },
              },
            },
          },
        },
        album_customers: {
          include: {
            album: {
              select: {
                id: true,
                title: true,
                is_published: true,
                _count: { select: { album_assets: true } },
              },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const formatted = customers.map((c) => {
      const albums = c.album_customers.map((ac) => ({
        id: ac.album.id,
        title: ac.album.title,
        is_published: ac.album.is_published,
        can_download: ac.can_download,
        can_favorite: ac.can_favorite,
        assets_count: ac.album._count?.album_assets || 0,
      }));
      const totalPhotos = albums.reduce((acc, a) => acc + (a.assets_count || 0), 0);

      return {
        id: c.id,
        studio_id: c.studio_id,
        user_id: c.user_id,
        email: c.user.email,
        full_name: c.user.full_name,
        phone: c.user.phone,
        address: c.address,
        notes: c.notes,
        total_events: c.event_customers.length,
        total_albums: c.album_customers.length,
        total_photos: totalPhotos,
        events: c.event_customers.map((ec) => ec.event),
        albums,
        created_at: c.created_at,
      };
    });

    res.json(formatted);
  } catch (err) {
    next(err);
  }
}

async function updateCustomer(req, res, next) {
  try {
    const { id } = req.params;
    const { full_name, phone, address, notes } = req.body;
    const customer = await prisma.customers.findFirst({
      where: { id, studio_id: req.studioId },
      include: { user: true },
    });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    if (full_name !== undefined || phone !== undefined) {
      await prisma.users.update({
        where: { id: customer.user_id },
        data: {
          ...(full_name ? { full_name: full_name.trim() } : {}),
          ...(phone !== undefined ? { phone: phone ? phone.trim() : null } : {}),
        },
      });
    }
    const updated = await prisma.customers.update({
      where: { id },
      data: {
        ...(address !== undefined ? { address } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
      include: { user: true },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteCustomer(req, res, next) {
  try {
    const { id } = req.params;
    await prisma.customers.deleteMany({
      where: { id, studio_id: req.studioId },
    });
    res.json({ message: 'Customer removed successfully' });
  } catch (err) {
    next(err);
  }
}

async function unshareAlbum(req, res, next) {
  try {
    const { album_id, customer_id } = req.body;
    if (!album_id || !customer_id) {
      return res.status(400).json({ error: 'album_id and customer_id are required' });
    }
    await prisma.album_customers.deleteMany({
      where: {
        album_id,
        customer_id,
        album: { studio_id: req.studioId },
      },
    });
    res.json({ message: 'Album unshared from customer' });
  } catch (err) {
    next(err);
  }
}

async function createCustomer(req, res, next) {
  try {
    const { full_name, email, phone, address, notes } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !full_name) {
      return res.status(400).json({ error: 'Full name and email are required' });
    }

    if (!req.studioId) {
      return res.status(400).json({ error: 'Studio context required' });
    }

    let temporaryPassword;
    let user = await prisma.users.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      temporaryPassword=require('crypto').randomBytes(18).toString('base64url');
      const password_hash = await bcrypt.hash(temporaryPassword, salt);
      user = await prisma.users.create({
        data: {
          email: normalizedEmail,
          password_hash,
          full_name: full_name.trim(),
          phone: phone || null,
          is_super_admin: false,
        },
      });
    }

    const existingCustomer = await prisma.customers.findUnique({
      where: {
        studio_id_user_id: {
          studio_id: req.studioId,
          user_id: user.id,
        },
      },
    });

    if (existingCustomer) {
      return res.status(409).json({ error: 'This customer is already registered with your studio' });
    }

    const customer = await prisma.customers.create({
      data: {
        studio_id: req.studioId,
        user_id: user.id,
        address: address || null,
        notes: notes || null,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
            phone: true,
          },
        },
        event_customers: {
          include: {
            event: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        album_customers: {
          include: {
            album: {
              select: { id: true, title: true, is_published: true },
            },
          },
        },
      },
    });

    res.status(201).json({
      temporary_password: temporaryPassword,
      id: customer.id,
      studio_id: customer.studio_id,
      user_id: customer.user_id,
      email: customer.user.email,
      full_name: customer.user.full_name,
      phone: customer.user.phone,
      address: customer.address,
      notes: customer.notes,
      total_events: customer.event_customers.length,
      total_albums: customer.album_customers.length,
      events: customer.event_customers.map((ec) => ec.event),
      albums: customer.album_customers.map((ac) => ac.album),
      created_at: customer.created_at,
    });
  } catch (err) {
    next(err);
  }
}

async function getMyGalleries(req, res, next) {
  try {
    const albumCustomers = await prisma.album_customers.findMany({
      where: {
        customer: {
          user_id: req.user.id,
        },
        album: { is_published: true, studio: { is_active: true } },
      },
      include: {
        album: {
          include: {
            studio: {
              include: { studio_branding: true },
            },
            album_assets: {
              include: { asset: true },
              orderBy: { sort_order: 'asc' },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    let formatted = (albumCustomers || []).map((ac) => ({
      ...ac.album,
      album_assets: (ac.album?.album_assets || []).map((aa) => ({
        ...aa,
        asset: aa.asset
          ? {
              ...aa.asset,
              file_size_bytes: aa.asset.file_size_bytes ? aa.asset.file_size_bytes.toString() : '0',
            }
          : aa.asset,
      })),
      can_download: ac.can_download,
      can_favorite: ac.can_favorite,
      studio_name: ac.album?.studio?.name || 'StudioFlow',
      brand_name: ac.album?.studio?.studio_branding?.brand_name || ac.album?.studio?.name,
      logo_url: ac.album?.studio?.studio_branding?.logo_url,
      primary_color: ac.album?.studio?.studio_branding?.primary_color || '#3B82F6',
      photo_count: ac.album?.album_assets?.length || 0,
      cover: ac.album?.album_assets?.[0]?.asset
        ? `/api/customer/assets/${ac.album.album_assets[0].asset.id}/view`
        : null,
      assets: (ac.album?.album_assets || [])
        .filter((aa) => aa.asset && !aa.asset.is_soft_deleted)
        .map((aa) => ({
          id: aa.asset.id,
          filename: aa.asset.filename,
          mime_type: aa.asset.mime_type,
          file_size_bytes: aa.asset.file_size_bytes ? aa.asset.file_size_bytes.toString() : '0',
          thumbnailUrl: `/api/customer/assets/${aa.asset.id}/view`,
          created_at: aa.asset.created_at,
        })),
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
}

async function getAlbumById(req, res, next) {
  try {
    const albumId = req.params.id;
    const album = await prisma.albums.findFirst({
      where: {
        id: albumId,
        ...albumAccessWhere(req.user.id),
      },
      include: {
        studio: {
          include: { studio_branding: true },
        },
        album_assets: {
          include: { asset: true },
          orderBy: { sort_order: 'asc' },
        },
      },
    });

    if (!album) {
      return res.status(404).json({ error: 'Album collection not found or not published' });
    }

    const assets = (album.album_assets || [])
      .filter((aa) => aa.asset && !aa.asset.is_soft_deleted)
      .map((aa) => ({
        id: aa.asset.id,
        filename: aa.asset.filename,
        mime_type: aa.asset.mime_type,
        file_size_bytes: aa.asset.file_size_bytes ? aa.asset.file_size_bytes.toString() : '0',
        thumbnailUrl: `/api/customer/assets/${aa.asset.id}/view`,
        created_at: aa.asset.created_at,
      }));

    const firstAsset = assets[0];
    const coverUrl = firstAsset ? firstAsset.thumbnailUrl : null;

    res.json({
      id: album.id,
      title: album.title,
      description: album.description,
      is_published: album.is_published,
      created_at: album.created_at,
      studio_name: album.studio?.name || 'StudioFlow',
      brand_name: album.studio?.studio_branding?.brand_name || album.studio?.name,
      logo_url: album.studio?.studio_branding?.logo_url,
      primary_color: album.studio?.studio_branding?.primary_color || '#3B82F6',
      photo_count: assets.length,
      cover: coverUrl,
      assets: assets,
    });
  } catch (err) {
    next(err);
  }
}

async function serveCustomerAsset(req, res, next) {
  try {
    const assetId = req.params.id;
    const asset = await prisma.assets.findFirst({
      where: { id: assetId, is_soft_deleted: false, album_assets: { some: { album: albumAccessWhere(req.user.id) } } },
    });
    if (!asset) return res.status(404).json({ error: 'Media not found' });
    if(req.query.download==='true') {
      const grant=await prisma.album_customers.findFirst({where:{can_download:true,customer:{user_id:req.user.id},album:{is_published:true,album_assets:{some:{asset_id:asset.id}}}}});
      if(!grant)return res.status(403).json({error:'Downloads are disabled for this gallery'});
    }
    return await deliverAsset(asset, req, res);
  } catch (err) {
    next(err);
  }
}

async function shareAlbum(req, res, next) {
  try {
    const { album_id, customer_id, can_download = true, can_favorite = true } = req.body;

    if (!album_id || !customer_id) {
      return res.status(400).json({ error: 'album_id and customer_id are required' });
    }

    if (!req.studioId) {
      return res.status(403).json({ error: 'Studio context is required to share albums' });
    }

    const [album, customer] = await Promise.all([
      prisma.albums.findFirst({
        where: {
          id: album_id,
          studio_id: req.studioId,
        },
        select: { id: true },
      }),
      prisma.customers.findFirst({
        where: {
          id: customer_id,
          studio_id: req.studioId,
        },
        select: { id: true },
      }),
    ]);

    if (!album || !customer) {
      return res.status(404).json({ error: 'Album or customer not found in this studio' });
    }

    const share = await prisma.album_customers.upsert({
      where: {
        album_id_customer_id: {
          album_id,
          customer_id,
        },
      },
      create: {
        album_id,
        customer_id,
        can_download,
        can_favorite,
      },
      update: {
        can_download,
        can_favorite,
      },
    });

    res.status(201).json(share);
  } catch (err) {
    next(err);
  }
}

async function downloadAsset(req, res, next) {
  try {
    const { assetId } = req.params;
    const asset = await prisma.assets.findFirst({
      where: { id: assetId, is_soft_deleted: false, album_assets: { some: { album: albumAccessWhere(req.user.id) } } },
    });
    if (!asset) return res.status(404).json({ error: 'Media not found or download unauthorized' });

    res.setHeader('Content-Disposition', `attachment; filename="${asset.filename}"`);
    return await deliverAsset(asset, req, res);
  } catch (err) {
    next(err);
  }
}

async function downloadAlbumZip(req, res, next) {
  try {
    const { albumId } = req.params;
    const album = await prisma.albums.findFirst({
      where: { id: albumId, ...albumAccessWhere(req.user.id), album_customers:{some:{can_download:true,customer:{user_id:req.user.id}}} },
      include: {
        album_assets: { include: { asset: true } },
      },
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found or download unauthorized' });
    }

    const archiver = require('archiver');
    const zip = archiver('zip', { zlib: { level: 5 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${album.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_photos.zip"`);

    zip.on('error', error => res.destroy(error));
    res.on('close', () => zip.abort());
    zip.pipe(res);

    for (const item of album.album_assets) {
      if (item.asset && !item.asset.is_soft_deleted) {
        const provider=await prisma.storage_providers.findFirst({where:{id:item.asset.storage_provider_id,studio_id:album.studio_id},include:{storage_credentials:true}});
        if(!provider || !item.asset.object_key) throw new Error('Original is not available in configured storage');
        const stream=await require('../services/storageAdapters').readObject(provider,item.asset.object_key);
        stream.on('error', error=>zip.destroy(error));
        zip.append(stream,{name:item.asset.id+'_'+require('path').basename(item.asset.filename)});
      }
    }

    await zip.finalize();
  } catch (err) {
    next(err);
  }
}

async function toggleFavorite(req, res, next) {
  try {
    const { albumId, assetId } = req.params;
    const { is_favorite } = req.body;

    const albumAsset = await prisma.album_assets.findFirst({
      where: {
        album_id: albumId,
        asset_id: assetId,
        album: {...albumAccessWhere(req.user.id),album_customers:{some:{can_favorite:true,customer:{user_id:req.user.id}}}},
      },
    });

    if (!albumAsset) {
      return res.status(404).json({ error: 'Album photo not found or favorite unauthorized' });
    }

    const nextState = is_favorite !== undefined ? Boolean(is_favorite) : !albumAsset.is_favorite;

    const updated = await prisma.album_assets.update({
      where: { id: albumAsset.id },
      data: { is_favorite: nextState },
    });

    res.json({ success: true, is_favorite: updated.is_favorite });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listStudioCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getMyGalleries,
  getAlbumById,
  serveCustomerAsset,
  shareAlbum,
  unshareAlbum,
  downloadAsset,
  downloadAlbumZip,
  toggleFavorite,
};
