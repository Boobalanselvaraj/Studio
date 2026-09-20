const BaseRepository = require('./base.repository');
const db = require('../config/db');

class FolderRepository extends BaseRepository {
  constructor() {
    super('folders');
  }

  async getTree(studioId) {
    const query = `
      SELECT f.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', fi.id,
              'item_type', fi.item_type,
              'item_id', fi.item_id,
              'sort_order', fi.sort_order
            )
          ) FILTER (WHERE fi.id IS NOT NULL), '[]'
        ) as items
      FROM folders f
      LEFT JOIN folder_items fi ON fi.folder_id = f.id
      WHERE f.studio_id = $1
      GROUP BY f.id
      ORDER BY f.sort_order ASC, f.name ASC
    `;
    const result = await db.query(query, [studioId]);
    return result.rows;
  }

  async create(studioId, data) {
    const { parent_folder_id, name, sort_order = 0, icon, color, naming_template } = data;
    const result = await db.query(
      `INSERT INTO folders (studio_id, parent_folder_id, name, sort_order, icon, color, naming_template)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [studioId, parent_folder_id || null, name, sort_order, icon, color, naming_template]
    );
    return result.rows[0];
  }

  async moveFolder(studioId, folderId, targetParentId) {
    const result = await db.query(
      `UPDATE folders
       SET parent_folder_id = $1, updated_at = NOW()
       WHERE studio_id = $2 AND id = $3
       RETURNING *`,
      [targetParentId || null, studioId, folderId]
    );
    return result.rows[0];
  }

  async addItem(folderId, itemType, itemId, sortOrder = 0) {
    const result = await db.query(
      `INSERT INTO folder_items (folder_id, item_type, item_id, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (folder_id, item_type, item_id) DO NOTHING
       RETURNING *`,
      [folderId, itemType, itemId, sortOrder]
    );
    return result.rows[0];
  }
}

module.exports = new FolderRepository();
