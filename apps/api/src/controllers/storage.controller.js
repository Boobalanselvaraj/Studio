const storageService = require('../services/storage/storage.service');

class StorageController {
  async list(req, res, next) {
    try {
      const providers = await storageService.getProviders(req.studioId);
      res.json(providers);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const provider = await storageService.createProvider(req.studioId, req.body);
      res.status(201).json(provider);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StorageController();
