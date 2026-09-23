const prisma = require('../config/prisma');

async function resolveTenant(req, res, next) {
  try {
    const studioIdHeader = req.headers['x-studio-id'];
    const studioSlug = req.params.studioSlug || req.query.studioSlug;

    let studioId = null;

    if (studioIdHeader) {
      studioId = studioIdHeader;
    } else if (studioSlug) {
      const studio = await prisma.studios.findFirst({
        where: { slug: studioSlug, is_active: true },
        select: { id: true },
      });
      if (studio) {
        studioId = studio.id;
      }
    } else if (req.user && req.session && req.session.currentStudioId) {
      studioId = req.session.currentStudioId;
    }

    if (!studioId) {
      return res.status(400).json({ error: 'Tenant context required: Studio ID or slug missing' });
    }

    // Verify studio existence and active status
    const studio = await prisma.studios.findUnique({
      where: { id: studioId },
      select: { id: true, name: true, slug: true, is_active: true },
    });

    if (!studio || !studio.is_active) {
      return res.status(404).json({ error: 'Studio not found or inactive' });
    }

    req.studio = studio;
    req.studioId = studio.id;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  resolveTenant,
};
