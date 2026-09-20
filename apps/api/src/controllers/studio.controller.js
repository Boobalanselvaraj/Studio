const studioService = require('../services/studio/studio.service');

class StudioController {
  async getProfile(req, res, next) {
    try {
      const studio = await studioService.getStudio(req.studioId);
      res.json(studio);
    } catch (err) {
      next(err);
    }
  }

  async getDashboardSummary(req, res, next) {
    try {
      res.json({
        studioId: req.studioId,
        todayTasksCount: 3,
        activeEventsCount: 8,
        storageUsedGb: '12.4',
        recentUploadsCount: 45
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new StudioController();
