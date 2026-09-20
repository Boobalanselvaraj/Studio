const prisma = require('../config/prisma');

const VALID_TAG_SOURCES = new Set(['manual', 'suggested']);

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
    const normalizedLabel = typeof label === 'string' ? label.trim() : '';

    if (!normalizedLabel) {
      return res.status(400).json({ error: 'Tag label is required' });
    }

    const tag = await prisma.tags.upsert({
      where: {
        studio_id_label: {
          studio_id: req.studioId,
          label: normalizedLabel,
        },
      },
      create: {
        studio_id: req.studioId,
        label: normalizedLabel,
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

    if (!tag_id) {
      return res.status(400).json({ error: 'tag_id is required' });
    }

    if (!VALID_TAG_SOURCES.has(source)) {
      return res.status(400).json({ error: 'Invalid tag source' });
    }

    const [tag, event] = await Promise.all([
      prisma.tags.findFirst({
        where: {
          id: tag_id,
          studio_id: req.studioId,
        },
        select: { id: true },
      }),
      prisma.events.findFirst({
        where: {
          id: eventId,
          studio_id: req.studioId,
        },
        select: { id: true },
      }),
    ]);

    if (!tag || !event) {
      return res.status(404).json({ error: 'Tag or event not found in this studio' });
    }

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

    if (!tag_id) {
      return res.status(400).json({ error: 'tag_id is required' });
    }

    if (!VALID_TAG_SOURCES.has(source)) {
      return res.status(400).json({ error: 'Invalid tag source' });
    }

    const [tag, asset] = await Promise.all([
      prisma.tags.findFirst({
        where: {
          id: tag_id,
          studio_id: req.studioId,
        },
        select: { id: true },
      }),
      prisma.assets.findFirst({
        where: {
          id: assetId,
          studio_id: req.studioId,
        },
        select: { id: true },
      }),
    ]);

    if (!tag || !asset) {
      return res.status(404).json({ error: 'Tag or asset not found in this studio' });
    }

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

async function getSuggestedTags(req, res, next) {
  try {
    const assetId = req.params.id;

    const asset = await prisma.assets.findFirst({
      where: {
        id: assetId,
        studio_id: req.studioId,
      },
      include: {
        asset_tags: {
          where: { source: 'suggested' },
          include: { tag: true },
        },
      },
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const suggestions = asset.asset_tags.map((at) => at.tag);
    res.json(suggestions);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  tagEvent,
  tagAsset,
  getSuggestedTags,
};
