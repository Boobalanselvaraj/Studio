const BaseRepository = require('./base.repository');
const db = require('../config/db');

class AssetRepository extends BaseRepository {
  constructor() {
    super('assets');
  }

  async findByAlbum(studioId, albumId) {
    const query = `
      SELECT a.*, aa.sort_order, aa.is_favorite
      FROM assets a
      JOIN album_assets aa ON aa.asset_id = a.id
      WHERE a.studio_id = $1 AND aa.album_id = $2 AND a.is_soft_deleted = false
      ORDER BY aa.sort_order ASC, a.created_at ASC
    `;
    const result = await db.query(query, [studioId, albumId]);
    return result.rows;
  }

  async create(studioId, assetData) {
    const {
      storage_provider_id,
      immich_asset_id,
      filename,
      original_path,
      mime_type,
      file_size_bytes,
      width,
      height,
      exif_data = {}
    } = assetData;

    const result = await db.query(
      `INSERT INTO assets (
        studio_id, storage_provider_id, immich_asset_id, 
        filename, original_path, mime_type, file_size_bytes, 
        width, height, exif_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        studioId, storage_provider_id, immich_asset_id,
        filename, original_path, mime_type, file_size_bytes,
        width, height, JSON.stringify(exif_data)
      ]
    );

    return result.rows[0];
  }

  async softDelete(studioId, assetId) {
    const result = await db.query(
      `UPDATE assets 
       SET is_soft_deleted = true, deleted_at = NOW() 
       WHERE studio_id = $1 AND id = $2 
       RETURNING *`,
      [studioId, assetId]
    );
    return result.rows[0];
  }
}

module.exports = new AssetRepository();
