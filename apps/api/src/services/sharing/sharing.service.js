const db = require('../../config/db');

class SharingService {
  async shareAlbumWithCustomer(albumId, customerId, permissions = { canDownload: true, canFavorite: true }) {
    const result = await db.query(
      `INSERT INTO album_customers (album_id, customer_id, can_download, can_favorite)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (album_id, customer_id) DO UPDATE SET
         can_download = EXCLUDED.can_download,
         can_favorite = EXCLUDED.can_favorite
       RETURNING *`,
      [albumId, customerId, permissions.canDownload, permissions.canFavorite]
    );
    return result.rows[0];
  }
}

module.exports = new SharingService();
