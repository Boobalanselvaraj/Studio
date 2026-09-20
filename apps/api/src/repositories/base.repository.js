const db = require('../config/db');

class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
    this.db = db;
  }

  // Tenant-enforced find by ID
  async findById(studioId, id) {
    const query = `SELECT * FROM ${this.tableName} WHERE studio_id = $1 AND id = $2`;
    const result = await this.db.query(query, [studioId, id]);
    return result.rows[0] || null;
  }

  // Tenant-enforced list
  async findAll(studioId, limit = 50, offset = 0) {
    const query = `SELECT * FROM ${this.tableName} WHERE studio_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
    const result = await this.db.query(query, [studioId, limit, offset]);
    return result.rows;
  }

  // Tenant-enforced delete
  async deleteById(studioId, id) {
    const query = `DELETE FROM ${this.tableName} WHERE studio_id = $1 AND id = $2 RETURNING *`;
    const result = await this.db.query(query, [studioId, id]);
    return result.rows[0] || null;
  }
}

module.exports = BaseRepository;
