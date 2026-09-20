const studioService = require('../services/studio/studio.service');
const billingService = require('../services/billing/billing.service');

class AdminController {
  async listStudios(req, res, next) {
    try {
      const studios = await studioService.getAllStudios();
      res.json(studios);
    } catch (err) {
      next(err);
    }
  }

  async createStudio(req, res, next) {
    try {
      const studio = await studioService.createStudio(req.body);
      res.status(201).json(studio);
    } catch (err) {
      next(err);
    }
  }

  async updateStudioBilling(req, res, next) {
    try {
      const profile = await billingService.updateStudioBillingProfile(req.params.id, req.body);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
