const prisma = require('../config/prisma');

class StudioController {
  async getProfile(req, res, next) {
    try {
      const studio = await prisma.studios.findUnique({
        where: { id: req.studioId },
        include: {
          studio_branding: true,
          studio_billing_profile: {
            include: { billing_plan: true },
          },
        },
      });
      res.json(studio);
    } catch (err) {
      next(err);
    }
  }

  async getDashboardSummary(req, res, next) {
    try {
      const studioId = req.studioId;

      const [activeEventsCount, totalCustomersCount, totalCamerasCount, tasks] = await Promise.all([
        prisma.events.count({
          where: {
            studio_id: studioId,
            status: { notIn: ['archived', 'cancelled'] },
          },
        }),
        prisma.customers.count({ where: { studio_id: studioId } }),
        prisma.cameras.count({ where: { studio_id: studioId, is_active: true } }),
        prisma.event_tasks.findMany({
          where: {
            event: { studio_id: studioId },
            is_done: false,
          },
          take: 5,
          orderBy: { due_date: 'asc' },
          include: {
            event: { select: { title: true } },
          },
        }),
      ]);

      res.json({
        studioId,
        activeEventsCount,
        totalCustomersCount,
        totalCamerasCount,
        pendingTasksCount: tasks.length,
        upcomingTasks: tasks,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StudioController();
