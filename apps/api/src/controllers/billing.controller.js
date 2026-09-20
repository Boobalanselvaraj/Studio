const billingService = require('../services/billing/billing.service');

class BillingController {
  async getUsage(req, res, next) {
    try {
      const usage = await billingService.getStudioUsage(req.studioId);
      res.json(usage);
    } catch (err) {
      next(err);
    }
  }

  async getProfile(req, res, next) {
    try {
      const profile = await billingService.getStudioBillingProfile(req.studioId);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }

  async getInvoices(req, res, next) {
    try {
      const invoices = await billingService.getInvoices(req.studioId);
      res.json(invoices);
    } catch (err) {
      next(err);
    }
  }

  async getPlans(req, res, next) {
    try {
      const plans = await billingService.getPlans();
      res.json(plans);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BillingController();
