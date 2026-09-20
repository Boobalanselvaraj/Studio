const prisma = require('../config/prisma');

class TaskController {
  async getEventTasks(req, res, next) {
    try {
      const tasks = await prisma.event_tasks.findMany({
        where: {
          event_id: req.params.eventId,
          event: {
            studio_id: req.studioId,
          },
        },
        include: {
          user_assignee: {
            select: {
              id: true,
              full_name: true,
            },
          },
        },
        orderBy: { created_at: 'asc' },
      });

      res.json(
        tasks.map((t) => ({
          ...t,
          assignee_name: t.user_assignee?.full_name || null,
        }))
      );
    } catch (err) {
      next(err);
    }
  }

  async createTask(req, res, next) {
    try {
      const { title, assignee_id, due_date, linked_folder_id } = req.body;
      const task = await prisma.event_tasks.create({
        data: {
          event_id: req.params.eventId,
          title,
          assignee_id: assignee_id || null,
          due_date: due_date ? new Date(due_date) : null,
          linked_folder_id: linked_folder_id || null,
        },
      });
      res.status(201).json(task);
    } catch (err) {
      next(err);
    }
  }

  async updateTask(req, res, next) {
    try {
      const { is_done, assignee_id, due_date, title } = req.body;
      const task = await prisma.event_tasks.update({
        where: { id: req.params.id },
        data: {
          is_done: is_done !== undefined ? is_done : undefined,
          assignee_id: assignee_id !== undefined ? assignee_id : undefined,
          due_date: due_date ? new Date(due_date) : undefined,
          title: title !== undefined ? title : undefined,
          updated_at: new Date(),
        },
      });
      res.json(task);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TaskController();
