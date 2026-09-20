const prisma = require('../config/prisma');
const { publishToQueue } = require('../config/rabbitmq');

function buildHierarchy(folders, parentId = null) {
  return folders
    .filter((f) => f.parent_folder_id === parentId)
    .map((folder) => ({
      ...folder,
      children: buildHierarchy(folders, folder.id),
    }));
}

async function getTree(req, res, next) {
  try {
    const flatFolders = await prisma.folders.findMany({
      where: { studio_id: req.studioId },
      include: {
        folder_items: {
          orderBy: { sort_order: 'asc' },
        },
      },
      orderBy: [{ sort_order: 'asc' }, { name: 'asc' }],
    });

    const tree = buildHierarchy(flatFolders, null);
    res.json(tree);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { parent_folder_id, name, sort_order = 0, icon, color, naming_template } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    if (parent_folder_id) {
      const parent = await prisma.folders.findFirst({
        where: { id: parent_folder_id, studio_id: req.studioId },
      });
      if (!parent) {
        return res.status(404).json({ error: 'Parent folder not found in this studio' });
      }
    }

    const folder = await prisma.folders.create({
      data: {
        studio_id: req.studioId,
        parent_folder_id: parent_folder_id || null,
        name,
        sort_order,
        icon,
        color,
        naming_template,
      },
    });

    res.status(201).json(folder);
  } catch (err) {
    next(err);
  }
}

async function move(req, res, next) {
  try {
    const { target_parent_id } = req.body;
    const folderId = req.params.id;

    if (target_parent_id === folderId) {
      return res.status(400).json({ error: 'Folder cannot be its own parent' });
    }

    const folder = await prisma.folders.findFirst({
      where: { id: folderId, studio_id: req.studioId },
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    if (target_parent_id) {
      const targetParent = await prisma.folders.findFirst({
        where: { id: target_parent_id, studio_id: req.studioId },
      });

      if (!targetParent) {
        return res.status(404).json({ error: 'Target parent folder not found' });
      }

      const descendantIds = await getDescendantFolderIds(folderId, req.studioId);
      if (descendantIds.includes(target_parent_id)) {
        return res.status(400).json({ error: 'Folder cannot be moved inside one of its descendants' });
      }
    }

    const updated = await prisma.folders.update({
      where: { id: folderId },
      data: {
        parent_folder_id: target_parent_id || null,
        updated_at: new Date(),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function getDescendantFolderIds(folderId, studioId) {
  const descendants = [];
  let currentParentIds = [folderId];

  while (currentParentIds.length > 0) {
    const children = await prisma.folders.findMany({
      where: {
        studio_id: studioId,
        parent_folder_id: { in: currentParentIds },
      },
      select: { id: true },
    });

    currentParentIds = children.map((child) => child.id);
    descendants.push(...currentParentIds);
  }

  return descendants;
}

async function bulkMove(req, res, next) {
  try {
    const { item_ids, target_folder_id } = req.body;

    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).json({ error: 'item_ids must be a non-empty array' });
    }

    const target = await prisma.folders.findFirst({
      where: { id: target_folder_id, studio_id: req.studioId },
    });

    if (!target) {
      return res.status(404).json({ error: 'Target destination folder not found' });
    }

    const items = await prisma.folder_items.findMany({
      where: {
        id: { in: item_ids },
        folder: {
          studio_id: req.studioId,
        },
      },
      select: { id: true },
    });

    if (items.length !== item_ids.length) {
      return res.status(400).json({ error: 'One or more folder items do not belong to this studio' });
    }

    await publishToQueue('media-sync', {
      action: 'bulk_folder_move',
      studioId: req.studioId,
      itemIds: item_ids,
      targetFolderId: target_folder_id,
      requestedBy: req.user ? req.user.id : null,
    });

    res.status(202).json({
      status: 'queued',
      message: `Queued bulk move of ${item_ids.length} item(s) to folder '${target.name}'`,
    });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const folderId = req.params.id;
    const { name, sort_order, icon, color, naming_template } = req.body;

    const folder = await prisma.folders.findFirst({
      where: { id: folderId, studio_id: req.studioId },
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const updated = await prisma.folders.update({
      where: { id: folderId },
      data: {
        name: name !== undefined ? name : undefined,
        sort_order: sort_order !== undefined ? sort_order : undefined,
        icon: icon !== undefined ? icon : undefined,
        color: color !== undefined ? color : undefined,
        naming_template: naming_template !== undefined ? naming_template : undefined,
        updated_at: new Date(),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteFolder(req, res, next) {
  try {
    const folderId = req.params.id;

    const folder = await prisma.folders.findFirst({
      where: { id: folderId, studio_id: req.studioId },
    });

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    await prisma.folders.delete({
      where: { id: folderId },
    });

    res.json({ message: 'Folder deleted successfully', id: folderId });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTree,
  create,
  update,
  move,
  bulkMove,
  delete: deleteFolder,
};
