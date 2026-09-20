const prisma = require('../../config/prisma');

class CustomerService {
  async getCustomers(studio_id) {
    const customers = await prisma.customers.findMany({
      where: { studio_id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
            phone: true,
          },
        },
        event_customers: true,
        album_customers: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return customers.map((c) => ({
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
      created_at: c.created_at,
    }));
  }

  async getCustomerAlbums(user_id) {
    const customer = await prisma.customers.findFirst({
      where: { user_id },
    });

    if (!customer) return [];

    const albumCustomers = await prisma.album_customers.findMany({
      where: {
        customer_id: customer.id,
        album: {
          is_published: true,
        },
      },
      include: {
        album: {
          include: {
            studio: {
              include: {
                studio_branding: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return albumCustomers.map((ac) => ({
      ...ac.album,
      studio_name: ac.album.studio.name,
      brand_name: ac.album.studio.studio_branding?.brand_name,
      logo_url: ac.album.studio.studio_branding?.logo_url,
      primary_color: ac.album.studio.studio_branding?.primary_color,
    }));
  }
}

module.exports = new CustomerService();
