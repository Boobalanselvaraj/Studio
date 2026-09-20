const db = require('../config/db');

class TaskController {
  async getEventTasks(req, res, next) {
    try {
      const result = await db.query(
        `SELECT et.*, u.full_name as assignee_name 
         FROM event_tasks et
         JOIN events e ON e.id = et.event_id
         LEFT JOIN users u ON u.id = et.assignee_id
         WHERE e.studio_id = $1 AND et.event_id = $2
         ORDER BY et.created_at ASC`,
        [req.studioId, req.params.eventId]
      );
      res.json(result.rows);
    } catch (err) {
      next(err);
    }
  }

  async createTask(req, res, next) {
    try {
      const { title, assignee_id, due_date, linked_folder_id } = req.body;
      const result = await db.query(
        `INSERT INTO event_tasks (event_id, title, assignee_id, due_date, linked_folder_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.params.eventId, title, assignee_id || null, due_date || null, linked_folder_id || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }

  async updateTask(req, res, next) {
    try {
      const { is_done, assignee_id, due_date, title } = req.body;
      const result = await db.query(
        `UPDATE event_tasks
         SET is_done = COALESCE($1, is_done),
             assignee_id = COALESCE($2, assignee_id),
             due_date = COALESCE($3, due_date),
             title = COALESCE($4, title),
             updated_at = NOW()
         WHERE id = $5
         RETURNING *`,
        [is_done, assignee_id, due_date, title, req.params.id]
      );
      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TaskController();
