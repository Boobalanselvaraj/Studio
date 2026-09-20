const prisma = require('../config/prisma');

class StudioRepository {
  async findById(id) {
    return prisma.studios.findUnique({
      where: { id },
      include: {
        studio_branding: true,
      },
    });
  }

  async findBySlug(slug) {
    return prisma.studios.findUnique({
      where: { slug },
      include: {
        studio_branding: true,
      },
    });
  }

  async findAll() {
    return prisma.studios.findMany({
      orderBy: { created_at: 'desc' },
      include: {
        studio_branding: true,
        studio_billing_profile: {
          include: {
            billing_plan: true,
          },
        },
      },
    });
  }

  async create({ name, slug, subdomain, custom_domain }) {
    return prisma.studios.create({
      data: {
        name,
        slug,
        subdomain,
        custom_domain,
      },
    });
  }

  async getBranding(studio_id) {
    return prisma.studio_branding.findUnique({
      where: { studio_id },
    });
  }

  async updateBranding(studio_id, data) {
    const { brand_name, logo_url, primary_color, secondary_color, accent_color, custom_css } = data;
    return prisma.studio_branding.upsert({
      where: { studio_id },
      create: {
        studio_id,
        brand_name,
        logo_url,
        primary_color,
        secondary_color,
        accent_color,
        custom_css,
      },
      update: {
        brand_name,
        logo_url,
        primary_color,
        secondary_color,
        accent_color,
        custom_css,
        updated_at: new Date(),
      },
    });
  }
}

module.exports = new StudioRepository();
