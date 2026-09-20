const db = require('../../config/db');

class AlbumService {
  async getStudioAlbums(studioId) {
    const query = `
      SELECT a.*, COUNT(aa.asset_id) as total_assets
      FROM albums a
      LEFT JOIN album_assets aa ON aa.album_id = a.id
      WHERE a.studio_id = $1
      GROUP BY a.id
      ORDER BY a.created_at DESC
    `;
    const result = await db.query(query, [studioId]);
    return result.rows;
  }

  async createAlbum(studioId, data) {
    const { title, description, event_id, is_published = false } = data;
    const result = await db.query(
      `INSERT INTO albums (studio_id, title, description, event_id, is_published)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [studioId, title, description, event_id || null, is_published]
    );
    return result.rows[0];
  }
}

module.exports = new AlbumService();
