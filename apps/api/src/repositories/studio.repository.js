const BaseRepository = require('./base.repository');
const db = require('../config/db');

class StudioRepository {
  async findById(id) {
    const result = await db.query('SELECT * FROM studios WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findBySlug(slug) {
    const result = await db.query('SELECT * FROM studios WHERE slug = $1', [slug]);
    return result.rows[0] || null;
  }

  async findAll() {
    const result = await db.query('SELECT * FROM studios ORDER BY created_at DESC');
    return result.rows;
  }

  async create({ name, slug, subdomain, custom_domain }) {
    const result = await db.query(
      `INSERT INTO studios (name, slug, subdomain, custom_domain)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, slug, subdomain, custom_domain]
    );
    return result.rows[0];
  }

  async getBranding(studioId) {
    const result = await db.query('SELECT * FROM studio_branding WHERE studio_id = $1', [studioId]);
    return result.rows[0] || null;
  }

  async updateBranding(studioId, data) {
    const { brand_name, logo_url, primary_color, secondary_color, accent_color, custom_css } = data;
    const result = await db.query(
      `INSERT INTO studio_branding (studio_id, brand_name, logo_url, primary_color, secondary_color, accent_color, custom_css)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (studio_id) DO UPDATE SET
         brand_name = EXCLUDED.brand_name,
         logo_url = EXCLUDED.logo_url,
         primary_color = EXCLUDED.primary_color,
         secondary_color = EXCLUDED.secondary_color,
         accent_color = EXCLUDED.accent_color,
         custom_css = EXCLUDED.custom_css,
         updated_at = NOW()
       RETURNING *`,
      [studioId, brand_name, logo_url, primary_color, secondary_color, accent_color, custom_css]
    );
    return result.rows[0];
  }
}

module.exports = new StudioRepository();
