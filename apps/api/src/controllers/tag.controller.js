const tagService = require('../services/tags/tag.service');

class TagController {
  async list(req, res, next) {
    try {
      const tags = await tagService.getStudioTags(req.studioId);
      res.json(tags);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const tag = await tagService.createTag(req.studioId, req.body);
      res.status(201).json(tag);
    } catch (err) {
      next(err);
    }
  }

  async tagEvent(req, res, next) {
    try {
      const { tag_id } = req.body;
      const result = await tagService.tagEvent(tag_id, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async tagAsset(req, res, next) {
    try {
      const { tag_id } = req.body;
      const result = await tagService.tagAsset(tag_id, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new TagController();
