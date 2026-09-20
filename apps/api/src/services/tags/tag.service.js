const prisma = require('../../config/prisma');

class TagService {
  async getStudioTags(studio_id) {
    return prisma.tags.findMany({
      where: { studio_id },
      orderBy: { label: 'asc' },
    });
  }

  async createTag(studio_id, { label, color }) {
    return prisma.tags.upsert({
      where: {
        studio_id_label: {
          studio_id,
          label,
        },
      },
      create: {
        studio_id,
        label,
        color: color || '#6B7280',
      },
      update: {
        color: color || undefined,
      },
    });
  }

  async tagEvent(tag_id, event_id, source = 'manual') {
    return prisma.event_tags.upsert({
      where: {
        tag_id_event_id: {
          tag_id,
          event_id,
        },
      },
      create: {
        tag_id,
        event_id,
        source: source || 'manual',
      },
      update: {
        source: source || undefined,
      },
    });
  }

  async tagAsset(tag_id, asset_id, source = 'manual') {
    return prisma.asset_tags.upsert({
      where: {
        tag_id_asset_id: {
          tag_id,
          asset_id,
        },
      },
      create: {
        tag_id,
        asset_id,
        source: source || 'manual',
      },
      update: {
        source: source || undefined,
      },
    });
  }
}

module.exports = new TagService();
