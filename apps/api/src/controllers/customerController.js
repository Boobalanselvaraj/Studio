const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');

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
        album: { is_published: true },
      },
      include: {
        album: {
          include: {
            studio: {
              include: { studio_branding: true },
            },
            album_assets: {
              include: { asset: true },
            },
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const formatted = albumCustomers.map((ac) => ({
      ...ac.album,
      can_download: ac.can_download,
      can_favorite: ac.can_favorite,
      studio_name: ac.album.studio.name,
      brand_name: ac.album.studio.studio_branding?.brand_name,
      logo_url: ac.album.studio.studio_branding?.logo_url,
      primary_color: ac.album.studio.studio_branding?.primary_color,
      photo_count: ac.album.album_assets.length,
    }));

    res.json(formatted);
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
  shareAlbum,
};
