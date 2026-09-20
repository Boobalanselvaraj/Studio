const BaseRepository = require('./base.repository');
const prisma = require('../config/prisma');

class FolderRepository extends BaseRepository {
  constructor() {
    super('folders');
  }

  async getTree(studio_id) {
    return prisma.folders.findMany({
      where: { studio_id },
      include: {
        folder_items: {
          orderBy: { sort_order: 'asc' },
        },
      },
      orderBy: [
        { sort_order: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  async create(studio_id, data) {
    const { parent_folder_id, name, sort_order = 0, icon, color, naming_template } = data;
    return prisma.folders.create({
      data: {
        studio_id,
        parent_folder_id: parent_folder_id || null,
        name,
        sort_order,
        icon,
        color,
        naming_template,
      },
    });
  }

  async moveFolder(studio_id, folder_id, target_parent_id) {
    return prisma.folders.updateMany({
      where: {
        id: folder_id,
        studio_id,
      },
      data: {
        parent_folder_id: target_parent_id || null,
        updated_at: new Date(),
      },
    });
  }

  async addItem(folder_id, item_type, item_id, sort_order = 0) {
    return prisma.folder_items.upsert({
      where: {
        folder_id_item_type_item_id: {
          folder_id,
          item_type,
          item_id,
        },
      },
      create: {
        folder_id,
        item_type,
        item_id,
        sort_order,
      },
      update: {
        sort_order,
      },
    });
  }
}

module.exports = new FolderRepository();
