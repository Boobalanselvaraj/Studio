const db = require('../../config/db');

class TagService {
  async getStudioTags(studioId) {
    const result = await db.query('SELECT * FROM tags WHERE studio_id = $1 ORDER BY label ASC', [studioId]);
    return result.rows;
  }

  async createTag(studioId, { label, color }) {
    const result = await db.query(
      `INSERT INTO tags (studio_id, label, color)
       VALUES ($1, $2, $3)
       ON CONFLICT (studio_id, label) DO UPDATE SET color = EXCLUDED.color
       RETURNING *`,
      [studioId, label, color || '#6B7280']
    );
    return result.rows[0];
  }

  async tagEvent(tagId, eventId, source = 'manual') {
    const result = await db.query(
      `INSERT INTO event_tags (tag_id, event_id, source)
       VALUES ($1, $2, $3)
       ON CONFLICT (tag_id, event_id) DO NOTHING
       RETURNING *`,
      [tagId, eventId, source]
    );
    return result.rows[0];
  }

  async tagAsset(tagId, assetId, source = 'manual') {
    const result = await db.query(
      `INSERT INTO asset_tags (tag_id, asset_id, source)
       VALUES ($1, $2, $3)
       ON CONFLICT (tag_id, asset_id) DO NOTHING
       RETURNING *`,
      [tagId, assetId, source]
    );
    return result.rows[0];
  }
}

module.exports = new TagService();
