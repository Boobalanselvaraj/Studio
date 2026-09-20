const BaseRepository = require('./base.repository');
const prisma = require('../config/prisma');

class EventRepository extends BaseRepository {
  constructor() {
    super('events');
  }

  async findFiltered(studio_id, filters = {}) {
    const where = { studio_id };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.eventType) {
      where.event_type = filters.eventType;
    }
    if (filters.fromDate || filters.toDate) {
      where.event_date_start = {};
      if (filters.fromDate) where.event_date_start.gte = new Date(filters.fromDate);
      if (filters.toDate) where.event_date_start.lte = new Date(filters.toDate);
    }

    const events = await prisma.events.findMany({
      where,
      include: {
        event_tasks: {
          select: {
            id: true,
            is_done: true,
          },
        },
        event_customers: {
          include: {
            customer: {
              include: {
                user: {
                  select: {
                    id: true,
                    full_name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { event_date_start: 'asc' },
        { created_at: 'desc' },
      ],
    });

    return events.map((e) => ({
      ...e,
      total_tasks: e.event_tasks.length,
      completed_tasks: e.event_tasks.filter((t) => t.is_done).length,
    }));
  }

  async create(studio_id, eventData) {
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
      created_by,
    } = eventData;

    return prisma.events.create({
      data: {
        studio_id,
        title,
        event_type,
        status,
        source,
        event_date_start: event_date_start ? new Date(event_date_start) : null,
        event_date_end: event_date_end ? new Date(event_date_end) : null,
        location,
        delivery_deadline: delivery_deadline ? new Date(delivery_deadline) : null,
        notes,
        created_by,
      },
    });
  }

  async updateStatus(studio_id, event_id, to_status, changed_by, note = '') {
    return prisma.$transaction(async (tx) => {
      const current = await tx.events.findFirst({
        where: { id: event_id, studio_id },
      });

      if (!current) {
        throw new Error('Event not found');
      }

      const updated = await tx.events.update({
        where: { id: event_id },
        data: {
          status: to_status,
          updated_at: new Date(),
        },
      });

      await tx.event_status_history.create({
        data: {
          event_id,
          from_status: current.status,
          to_status,
          changed_by,
          note,
        },
      });

      return updated;
    });
  }

  async getHistory(studio_id, event_id) {
    return prisma.event_status_history.findMany({
      where: {
        event_id,
        event: {
          studio_id,
        },
      },
      include: {
        user_changed: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }
}

module.exports = new EventRepository();
