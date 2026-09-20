const prisma = require('../config/prisma');

async function getBranding(req, res, next) {
  try {
    let branding = await prisma.studio_branding.findUnique({
      where: { studio_id: req.studioId },
    });

    if (!branding) {
      branding = {
        studio_id: req.studioId,
        brand_name: req.studio?.name || 'Studio Gallery',
        logo_url: null,
        primary_color: '#3B82F6',
        secondary_color: '#1E293B',
        accent_color: '#10B981',
        custom_css: null,
      };
    }

    res.json(branding);
  } catch (err) {
    next(err);
  }
}

async function updateBranding(req, res, next) {
  try {
    const { brand_name, logo_url, primary_color, secondary_color, accent_color, custom_css } = req.body;

    const branding = await prisma.studio_branding.upsert({
      where: { studio_id: req.studioId },
      create: {
        studio_id: req.studioId,
        brand_name,
        logo_url,
        primary_color: primary_color || '#3B82F6',
        secondary_color: secondary_color || '#1E293B',
        accent_color: accent_color || '#10B981',
        custom_css,
      },
      update: {
        brand_name: brand_name !== undefined ? brand_name : undefined,
        logo_url: logo_url !== undefined ? logo_url : undefined,
        primary_color: primary_color !== undefined ? primary_color : undefined,
        secondary_color: secondary_color !== undefined ? secondary_color : undefined,
        accent_color: accent_color !== undefined ? accent_color : undefined,
        custom_css: custom_css !== undefined ? custom_css : undefined,
        updated_at: new Date(),
      },
    });

    res.json(branding);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBranding,
  updateBranding,
};
