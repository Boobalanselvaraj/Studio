const prisma = require('../config/prisma');

class BillingController {
  async getUsage(req, res, next) {
    try {
      const studioId = req.studioId;

      const profile = await prisma.studio_billing_profile.findUnique({
        where: { studio_id: studioId },
        include: { billing_plan: true },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const usageAggregate = await prisma.storage_usage_snapshots.aggregate({
        where: {
          studio_id: studioId,
          snapshot_date: { gte: today },
        },
        _sum: { bytes_used: true },
      });

      const usedBytes = usageAggregate._sum.bytes_used ? Number(usageAggregate._sum.bytes_used) : 0;
      const quotaGb = profile ? Number(profile.storage_quota_gb) : 50;
      const quotaBytes = quotaGb * 1024 * 1024 * 1024;
      const usedGb = (usedBytes / (1024 * 1024 * 1024)).toFixed(2);
      const percentUsed = quotaBytes > 0 ? ((usedBytes / quotaBytes) * 100).toFixed(1) : '0';

      res.json({
        studioId,
        quotaGb,
        usedBytes,
        usedGb: parseFloat(usedGb),
        percentUsed: parseFloat(percentUsed),
        isApproachingQuota: parseFloat(percentUsed) >= 80,
        isExceeded: parseFloat(percentUsed) >= 100,
        billingStatus: profile?.billing_status || 'active',
        plan: profile?.billing_plan?.name || 'Custom Plan',
      });
    } catch (err) {
      next(err);
    }
  }

  async getProfile(req, res, next) {
    try {
      const profile = await prisma.studio_billing_profile.findUnique({
        where: { studio_id: req.studioId },
        include: { billing_plan: true },
      });
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }

  async getInvoices(req, res, next) {
    try {
      const invoices = await prisma.invoices.findMany({
        where: { studio_id: req.studioId },
        orderBy: { period_end: 'desc' },
      });
      res.json(invoices);
    } catch (err) {
      next(err);
    }
  }

  async getPlans(req, res, next) {
    try {
      const plans = await prisma.billing_plans.findMany({
        where: { is_active: true },
        orderBy: { storage_gb_min: 'asc' },
      });
      res.json(plans);
    } catch (err) {
      next(err);
    }
  }

  async requestUpgrade(req, res, next) {
    try {
      const { requested_quota_gb, notes } = req.body;
      res.status(202).json({
        message: 'Upgrade request submitted to platform administration',
        requestedQuotaGb: requested_quota_gb,
        notes,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BillingController();
