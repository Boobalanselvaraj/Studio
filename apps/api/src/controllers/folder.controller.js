const folderService = require('../services/folders/folderTree.service');
const folderRepo = require('../repositories/folder.repository');

class FolderController {
  async getTree(req, res, next) {
    try {
      const tree = await folderService.getTree(req.studioId);
      res.json(tree);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const folder = await folderService.createFolder(req.studioId, req.body);
      res.status(201).json(folder);
    } catch (err) {
      next(err);
    }
  }

  async move(req, res, next) {
    try {
      const { target_parent_id } = req.body;
      const moved = await folderService.moveFolder(req.studioId, req.params.id, target_parent_id);
      res.json(moved);
    } catch (err) {
      next(err);
    }
  }

  async bulkMove(req, res, next) {
    try {
      const result = await folderService.queueBulkMove(req.studioId, req.body);
      res.status(202).json(result);
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      const deleted = await folderRepo.deleteById(req.studioId, req.params.id);
      res.json({ message: 'Folder deleted successfully', deleted });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new FolderController();
