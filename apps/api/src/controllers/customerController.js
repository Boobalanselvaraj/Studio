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
      orderBy: { created_at: 'desc' },
    });

    const formatted = customers.map((c) => ({
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
      events: c.event_customers.map((ec) => ec.event),
      albums: c.album_customers.map((ac) => ac.album),
      created_at: c.created_at,
    }));

    res.json(formatted);
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

    let user = await prisma.users.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash('customer123456', salt);
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

module.exports = {
  listStudioCustomers,
  createCustomer,
  getMyGalleries,
  getAlbumById,
  serveCustomerAsset,
  shareAlbum,
};
