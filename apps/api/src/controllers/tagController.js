const prisma = require('../config/prisma');

async function list(req, res, next) {
  try {
    const tags = await prisma.tags.findMany({
      where: { studio_id: req.studioId },
      include: {
        _count: {
          select: {
            event_tags: true,
            asset_tags: true,
          },
        },
      },
      orderBy: { label: 'asc' },
    });
    res.json(tags);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { label, color } = req.body;

    if (!label) {
      return res.status(400).json({ error: 'Tag label is required' });
    }

    const tag = await prisma.tags.upsert({
      where: {
        studio_id_label: {
          studio_id: req.studioId,
          label,
        },
      },
      create: {
        studio_id: req.studioId,
        label,
        color: color || '#6B7280',
      },
      update: {
        color: color || undefined,
      },
    });

    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
}

async function tagEvent(req, res, next) {
  try {
    const { tag_id, source = 'manual' } = req.body;
    const eventId = req.params.id;

    const eventTag = await prisma.event_tags.upsert({
      where: {
        tag_id_event_id: {
          tag_id,
          event_id: eventId,
        },
      },
      create: {
        tag_id,
        event_id: eventId,
        source,
      },
      update: {
        source,
      },
    });

    res.json(eventTag);
  } catch (err) {
    next(err);
  }
}

async function tagAsset(req, res, next) {
  try {
    const { tag_id, source = 'manual' } = req.body;
    const assetId = req.params.id;

    const assetTag = await prisma.asset_tags.upsert({
      where: {
        tag_id_asset_id: {
          tag_id,
          asset_id: assetId,
        },
      },
      create: {
        tag_id,
        asset_id: assetId,
        source,
      },
      update: {
        source,
      },
    });

    res.json(assetTag);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  tagEvent,
  tagAsset,
};
