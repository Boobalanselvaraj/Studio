const db = require('../config/db');

async function resolveTenant(req, res, next) {
  try {
    const studioIdHeader = req.headers['x-studio-id'];
    const studioSlug = req.params.studioSlug || req.query.studioSlug;

    let studioId = null;

    if (studioIdHeader) {
      studioId = studioIdHeader;
    } else if (studioSlug) {
      const studioRes = await db.query('SELECT id FROM studios WHERE slug = $1 AND is_active = true', [studioSlug]);
      if (studioRes.rows.length > 0) {
        studioId = studioRes.rows[0].id;
      }
    } else if (req.user && req.session && req.session.currentStudioId) {
      studioId = req.session.currentStudioId;
    }

    if (!studioId) {
      return res.status(400).json({ error: 'Tenant context required: Studio ID or slug missing' });
    }

    // Verify studio existence and active status
    const result = await db.query('SELECT id, name, slug, is_active FROM studios WHERE id = $1', [studioId]);
    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.status(404).json({ error: 'Studio not found or inactive' });
    }

    req.studio = result.rows[0];
    req.studioId = req.studio.id;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  resolveTenant
};
