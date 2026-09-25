const prisma = require('../config/prisma');

const statuses = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
const categories = ['general', 'camera', 'upload', 'gallery', 'account', 'billing', 'bug'];
const priorities = ['low', 'normal', 'high', 'urgent'];

const scope = (req) => (req.studioId ? { studio_id: req.studioId } : {});

exports.list = async (req, res, next) => {
  try {
    const tickets = await prisma.support_tickets.findMany({
      where: scope(req),
      orderBy: { updated_at: 'desc' },
    });
    const studioIds = [...new Set(tickets.map((t) => t.studio_id))];
    const userIds = [...new Set(tickets.map((t) => t.created_by).filter(Boolean))];

    const [studios, users] = await Promise.all([
      prisma.studios.findMany({
        where: { id: { in: studioIds } },
        select: { id: true, name: true },
      }),
      prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, full_name: true, email: true, is_super_admin: true },
      }),
    ]);

    res.json(
      tickets.map((t) => {
        const creator = users.find((u) => u.id === t.created_by);
        return {
          ...t,
          studio: studios.find((s) => s.id === t.studio_id),
          creator: creator
            ? { id: creator.id, name: creator.full_name, email: creator.email, is_super_admin: creator.is_super_admin }
            : null,
          created_by_super_admin: Boolean(creator?.is_super_admin),
        };
      })
    );
  } catch (e) {
    next(e);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { subject, description, category = 'general', priority = 'normal' } = req.body;
    const studioId = req.studioId || req.body.studio_id;

    if (
      typeof subject !== 'string' ||
      !subject.trim() ||
      subject.length > 200 ||
      typeof description !== 'string' ||
      !description.trim() ||
      description.length > 10000 ||
      !categories.includes(category) ||
      !priorities.includes(priority)
    ) {
      return res.status(400).json({ error: 'Enter a valid subject, issue description, category and priority' });
    }

    if (!studioId || !(await prisma.studios.findUnique({ where: { id: studioId } }))) {
      return res.status(404).json({ error: 'Studio not found' });
    }

    const ticket = await prisma.support_tickets.create({
      data: {
        studio_id: studioId,
        created_by: req.user.id,
        subject: subject.trim(),
        description: description.trim(),
        category,
        priority,
      },
    });

    res.status(201).json(ticket);
  } catch (e) {
    next(e);
  }
};

exports.update = async (req, res, next) => {
  try {
    const existing = await prisma.support_tickets.findFirst({
      where: { id: req.params.id, ...scope(req) },
      select: { id: true, created_by: true, status: true },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });

    const isSuperAdmin = Boolean(req.user?.is_super_admin);

    // For studio users: only allow status change on super-admin-created tickets
    if (!isSuperAdmin) {
      const creator = await prisma.users.findUnique({
        where: { id: existing.created_by },
        select: { id: true, is_super_admin: true },
      });
      if (creator?.is_super_admin) {
        // Only allow status field, block everything else
        const { status, priority, resolution, subject, description, category } = req.body;
        const hasOtherFields = priority !== undefined || resolution !== undefined || subject !== undefined || description !== undefined || category !== undefined;
        if (hasOtherFields) {
          return res.status(403).json({
            error: 'Super Admin tickets: studios can only update the ticket status. Other fields are locked.',
          });
        }
        if (status === undefined) return res.status(400).json({ error: 'No valid fields to update' });
        if (!statuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });
        const updated = await prisma.support_tickets.update({
          where: { id: existing.id },
          data: { status },
        });
        return res.json(updated);
      }
    }

    const { status, priority, resolution, subject, description, category } = req.body;

    if (status !== undefined && !statuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (priority !== undefined && !priorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }
    if (category !== undefined && !categories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    if (resolution !== undefined && (typeof resolution !== 'string' || resolution.length > 10000)) {
      return res.status(400).json({ error: 'Invalid resolution length' });
    }
    if (subject !== undefined && (typeof subject !== 'string' || !subject.trim() || subject.length > 200)) {
      return res.status(400).json({ error: 'Invalid subject' });
    }
    if (description !== undefined && (typeof description !== 'string' || !description.trim() || description.length > 10000)) {
      return res.status(400).json({ error: 'Invalid description' });
    }

    const data = {};
    if (priority !== undefined) data.priority = priority;
    if (subject !== undefined) data.subject = subject.trim();
    if (description !== undefined) data.description = description.trim();
    if (category !== undefined) data.category = category;
    if (status !== undefined) data.status = status;
    if (resolution !== undefined) data.resolution = resolution;

    const updated = await prisma.support_tickets.update({
      where: { id: existing.id },
      data,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const existing = await prisma.support_tickets.findFirst({
      where: { id: req.params.id, ...scope(req) },
    });
    if (!existing) return res.status(404).json({ error: 'Ticket not found' });

    const isSuperAdmin = Boolean(req.user?.is_super_admin);
    // If studio user: cannot delete tickets created by Super Admin or another user
    if (!isSuperAdmin) {
      const creator = await prisma.users.findUnique({
        where: { id: existing.created_by },
        select: { id: true, is_super_admin: true },
      });
      if (creator?.is_super_admin) {
        return res.status(403).json({
          error: 'Tickets created by Super Admin cannot be deleted by studio. You can update the status to resolved or closed instead.',
        });
      }
      if (existing.created_by !== req.user.id) {
        return res.status(403).json({
          error: 'You can only delete tickets created by your account.',
        });
      }
    }

    await prisma.support_tickets.delete({
      where: { id: existing.id },
    });
    res.json({ message: 'Ticket removed successfully' });
  } catch (e) {
    next(e);
  }
};
