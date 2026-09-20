const folderRepo = require('../../repositories/folder.repository');
const { publishToQueue } = require('../../config/rabbitmq');

class FolderTreeService {
  async getTree(studioId) {
    const rawFolders = await folderRepo.getTree(studioId);
    return this.buildHierarchy(rawFolders);
  }

  buildHierarchy(folders, parentId = null) {
    return folders
      .filter(f => f.parent_folder_id === parentId)
      .map(folder => ({
        ...folder,
        children: this.buildHierarchy(folders, folder.id)
      }));
  }

  async createFolder(studioId, folderData) {
    return folderRepo.create(studioId, folderData);
  }

  async moveFolder(studioId, folderId, targetParentId) {
    return folderRepo.moveFolder(studioId, folderId, targetParentId);
  }

  async queueBulkMove(studioId, { item_ids, target_folder_id }) {
    await publishToQueue('media-sync', {
      action: 'bulk_folder_move',
      studioId,
      itemIds: item_ids,
      targetFolderId: target_folder_id
    });

    return { status: 'queued', message: 'Bulk move job queued successfully' };
  }
}

module.exports = new FolderTreeService();
