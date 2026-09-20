const prisma = require('../config/prisma');
const { publishToQueue } = require('../config/rabbitmq');

const VALID_STATUS_TRANSITIONS = {
  lead: ['booked', 'cancelled'],
  booked: ['scheduled', 'cancelled'],
  scheduled: ['shooting', 'cancelled'],
  shooting: ['editing', 'cancelled'],
  editing: ['review', 'cancelled'],
  review: ['delivered', 'editing', 'cancelled'],
  delivered: ['archived'],
  archived: [],
  cancelled: ['lead', 'booked'],
};

class EventController {
  async list(req, res, next) {
    try {
      const { status, type, from, to } = req.query;
      const where = { studio_id: req.studioId };

      if (status) where.status = status;
      if (type) where.event_type = type;
      if (from || to) {
        where.event_date_start = {};
        if (from) where.event_date_start.gte = new Date(from);
        if (to) where.event_date_start.lte = new Date(to);
      }

      const eventsList = await prisma.events.findMany({
        where,
        include: {
          event_tasks: {
            select: { id: true, is_done: true },
          },
          event_customers: {
            include: {
              customer: {
                include: {
                  user: {
                    select: { id: true, full_name: true, email: true },
                  },
                },
              },
            },
          },
        },
        orderBy: [{ event_date_start: 'asc' }, { created_at: 'desc' }],
      });

      const formatted = eventsList.map((e) => ({
        ...e,
        total_tasks: e.event_tasks.length,
        completed_tasks: e.event_tasks.filter((t) => t.is_done).length,
      }));

      res.json(formatted);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
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
      } = req.body;

      if (!title || !event_type) {
        return res.status(400).json({ error: 'Title and event_type are required' });
      }

      const event = await prisma.$transaction(async (tx) => {
        const created = await tx.events.create({
          data: {
            studio_id: req.studioId,
            title,
            event_type,
            status,
            source,
            event_date_start: event_date_start ? new Date(event_date_start) : null,
            event_date_end: event_date_end ? new Date(event_date_end) : null,
            location,
            delivery_deadline: delivery_deadline ? new Date(delivery_deadline) : null,
            notes,
            created_by: req.user ? req.user.id : null,
          },
        });

        await tx.event_status_history.create({
          data: {
            event_id: created.id,
            from_status: null,
            to_status: created.status,
            changed_by: req.user ? req.user.id : null,
            note: 'Initial event creation',
          },
        });

        return created;
      });

      // Dispatch event automation async job
      await publishToQueue('event-automation', {
        action: 'event_created',
        studioId: req.studioId,
        eventId: event.id,
      });

      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const event = await prisma.events.findFirst({
        where: {
          id: req.params.id,
          studio_id: req.studioId,
        },
        include: {
          event_tasks: {
            include: {
              user_assignee: {
                select: { id: true, full_name: true, email: true },
              },
            },
          },
          event_customers: {
            include: {
              customer: {
                include: {
                  user: {
                    select: { id: true, full_name: true, email: true },
                  },
                },
              },
            },
          },
          event_status_history: {
            include: {
              user_changed: {
                select: { id: true, full_name: true },
              },
            },
            orderBy: { created_at: 'desc' },
          },
        },
      });

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json(event);
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { to_status, note = '' } = req.body;
      const eventId = req.params.id;

      if (!to_status) {
        return res.status(400).json({ error: 'to_status is required' });
      }

      const current = await prisma.events.findFirst({
        where: { id: eventId, studio_id: req.studioId },
      });

      if (!current) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const allowed = VALID_STATUS_TRANSITIONS[current.status] || [];
      if (!allowed.includes(to_status)) {
        return res.status(400).json({
          error: `Invalid status transition from '${current.status}' to '${to_status}'. Allowed: [${allowed.join(', ')}]`,
        });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const ev = await tx.events.update({
          where: { id: eventId },
          data: {
            status: to_status,
            updated_at: new Date(),
          },
        });

        await tx.event_status_history.create({
          data: {
            event_id: eventId,
            from_status: current.status,
            to_status,
            changed_by: req.user ? req.user.id : null,
            note,
          },
        });

        return ev;
      });

      await publishToQueue('event-automation', {
        action: 'status_changed',
        studioId: req.studioId,
        eventId,
        fromStatus: current.status,
        toStatus: to_status,
        userId: req.user ? req.user.id : null,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  async getHistory(req, res, next) {
    try {
      const history = await prisma.event_status_history.findMany({
        where: {
          event_id: req.params.id,
          event: {
            studio_id: req.studioId,
          },
        },
        include: {
          user_changed: {
            select: { id: true, full_name: true },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      res.json(history);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new EventController();
