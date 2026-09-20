const BaseRepository = require('./base.repository');
const db = require('../config/db');

class EventRepository extends BaseRepository {
  constructor() {
    super('events');
  }

  async findFiltered(studioId, filters = {}) {
    let query = `
      SELECT e.*, 
        COUNT(DISTINCT et.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN et.is_done THEN et.id END) as completed_tasks
      FROM events e
      LEFT JOIN event_tasks et ON et.event_id = e.id
      WHERE e.studio_id = $1
    `;
    const params = [studioId];

    if (filters.status) {
      params.push(filters.status);
      query += ` AND e.status = $${params.length}`;
    }

    if (filters.eventType) {
      params.push(filters.eventType);
      query += ` AND e.event_type = $${params.length}`;
    }

    if (filters.fromDate) {
      params.push(filters.fromDate);
      query += ` AND e.event_date_start >= $${params.length}`;
    }

    if (filters.toDate) {
      params.push(filters.toDate);
      query += ` AND e.event_date_start <= $${params.length}`;
    }

    query += ` GROUP BY e.id ORDER BY e.event_date_start ASC NULLS LAST, e.created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  }

  async create(studioId, eventData) {
    const {
      title,
      event_type,
      status = 'lead',
      source = 'manual',
      event_date_start,
      event_date_end,
      location,
      delivery_deadline,
      notes,
      created_by
    } = eventData;

    const result = await db.query(
      `INSERT INTO events (
        studio_id, title, event_type, status, source, 
        event_date_start, event_date_end, location, 
        delivery_deadline, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        studioId, title, event_type, status, source,
        event_date_start, event_date_end, location,
        delivery_deadline, notes, created_by
      ]
    );

    return result.rows[0];
  }

  async updateStatus(studioId, eventId, toStatus, changedBy, note = '') {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const current = await client.query(
        'SELECT status FROM events WHERE studio_id = $1 AND id = $2 FOR UPDATE',
        [studioId, eventId]
      );

      if (current.rows.length === 0) {
        throw new Error('Event not found');
      }

      const fromStatus = current.rows[0].status;

      const updated = await client.query(
        `UPDATE events 
         SET status = $1, updated_at = NOW() 
         WHERE studio_id = $2 AND id = $3 
         RETURNING *`,
        [toStatus, studioId, eventId]
      );

      await client.query(
        `INSERT INTO event_status_history (event_id, from_status, to_status, changed_by, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [eventId, fromStatus, toStatus, changedBy, note]
      );

      await client.query('COMMIT');
      return updated.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getHistory(studioId, eventId) {
    const result = await db.query(
      `SELECT h.*, u.full_name as changed_by_name
       FROM event_status_history h
       JOIN events e ON e.id = h.event_id
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE e.studio_id = $1 AND e.id = $2
       ORDER BY h.created_at DESC`,
      [studioId, eventId]
    );
    return result.rows;
  }
}

module.exports = new EventRepository();
