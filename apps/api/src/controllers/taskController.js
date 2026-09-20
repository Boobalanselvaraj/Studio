const prisma = require('../config/prisma');

async function getEventTasks(req, res, next) {
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
            email: true,
          },
        },
        folder: {
          select: { id: true, name: true },
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

async function createTask(req, res, next) {
  try {
    const { title, assignee_id, due_date, linked_folder_id } = req.body;
    const eventId = req.params.eventId;

    if (!title) {
      return res.status(400).json({ error: 'Task title is required' });
    }

    const task = await prisma.event_tasks.create({
      data: {
        event_id: eventId,
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

async function updateTask(req, res, next) {
  try {
    const { is_done, assignee_id, due_date, title } = req.body;
    const taskId = req.params.id;

    const task = await prisma.event_tasks.update({
      where: { id: taskId },
      data: {
        is_done: is_done !== undefined ? !!is_done : undefined,
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

async function deleteTask(req, res, next) {
  try {
    const taskId = req.params.id;
    await prisma.event_tasks.delete({ where: { id: taskId } });
    res.json({ message: 'Task deleted successfully', id: taskId });
  } catch (err) {
    next(err);
  }
}

async function getTaskTemplates(req, res, next) {
  try {
    const { event_type } = req.query;
    const where = { studio_id: req.studioId };
    if (event_type) where.event_type = event_type;

    const templates = await prisma.event_task_templates.findMany({
      where,
      orderBy: { sort_order: 'asc' },
    });
    res.json(templates);
  } catch (err) {
    next(err);
  }
}

async function createTaskTemplate(req, res, next) {
  try {
    const { event_type, title, sort_order = 0 } = req.body;

    if (!event_type || !title) {
      return res.status(400).json({ error: 'event_type and title are required' });
    }

    const template = await prisma.event_task_templates.create({
      data: {
        studio_id: req.studioId,
        event_type,
        title,
        sort_order,
      },
    });

    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getEventTasks,
  createTask,
  updateTask,
  deleteTask,
  getTaskTemplates,
  createTaskTemplate,
};
