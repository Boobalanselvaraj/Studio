const prisma = require('../config/prisma');

class CustomerController {
  async listStudioCustomers(req, res, next) {
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

  async getMyGalleries(req, res, next) {
    try {
      const customer = await prisma.customers.findFirst({
        where: { user_id: req.user.id },
      });

      if (!customer) {
        return res.json([]);
      }

      const albumCustomers = await prisma.album_customers.findMany({
        where: {
          customer_id: customer.id,
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

  async shareAlbum(req, res, next) {
    try {
      const { album_id, customer_id, can_download = true, can_favorite = true } = req.body;

      if (!album_id || !customer_id) {
        return res.status(400).json({ error: 'album_id and customer_id are required' });
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
}

module.exports = new CustomerController();
