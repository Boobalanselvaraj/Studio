const brandingService = require('../services/branding/branding.service');

class BrandingController {
  async getBranding(req, res, next) {
    try {
      const branding = await brandingService.getStudioBranding(req.studioId);
      res.json(branding);
    } catch (err) {
      next(err);
    }
  }

  async updateBranding(req, res, next) {
    try {
      const branding = await brandingService.updateStudioBranding(req.studioId, req.body);
      res.json(branding);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BrandingController();
