const prisma = require('../config/prisma');
const { getStudioUsage } = require('../services/allocationService');

async function getUsage(req, res, next) {
  try {
    const studioId = req.studioId;

    const profile = prisma.studio_billing_profile?.findUnique
      ? await prisma.studio_billing_profile.findUnique({
          where: { studio_id: studioId },
          include: { billing_plan: true },
        })
      : null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let snapshotBytes = null;
    if (prisma.storage_usage_snapshots?.aggregate) {
      try {
        const usageAggregate = await prisma.storage_usage_snapshots.aggregate({
          where: {
            studio_id: studioId,
            snapshot_date: { gte: today },
            storage_provider: {
              provider_type: 'platform',
            },
          },
          _sum: { bytes_used: true },
        });
        if (usageAggregate?._sum?.bytes_used !== undefined && usageAggregate._sum.bytes_used !== null) {
          snapshotBytes = Number(usageAggregate._sum.bytes_used);
        }
      } catch (_) {}
    }

    const usage = await getStudioUsage(studioId);

    const usedBytes = snapshotBytes !== null ? snapshotBytes : Number(usage.platform.usedBytes);
    const quotaGb = profile ? Number(profile.storage_quota_gb) : usage.platform.quotaGb;
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
      billingStatus: profile?.billing_status || usage.billingStatus,
      plan: profile?.billing_plan?.name || usage.plan,
      platform: {
        ...usage.platform,
        usedBytes: usedBytes.toString(),
        usedGb: parseFloat(usedGb),
        percentUsed: parseFloat(percentUsed),
      },
      studioOwned: usage.studioOwned,
      cameras: usage.cameras,
    });
  } catch (err) {
    next(err);
  }
}

async function getProfile(req, res, next) {
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

async function getInvoices(req, res, next) {
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

async function getPlans(req, res, next) {
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

async function requestUpgrade(req, res, next) {
  try {
    const { requested_quota_gb, notes } = req.body;
    const requestedQuotaGb = Number(requested_quota_gb);

    if (!Number.isFinite(requestedQuotaGb) || requestedQuotaGb <= 0) {
      return res.status(400).json({ error: 'requested_quota_gb must be a positive number' });
    }

    // Plan requirement: Durable allocation request, visible status and admin resolution; no entitlement change on submission.
    const request = await prisma.allocation_requests.create({
      data: {
        studio_id: req.studioId,
        requested_by: req.user.id,
        requested_quota_gb: requestedQuotaGb,
        notes: notes ? String(notes).trim() : null,
        status: 'pending',
      },
    });

    res.status(202).json({
      message: 'Upgrade request submitted to platform administration for review',
      request,
    });
  } catch (err) {
    next(err);
  }
}

async function getAllocationRequests(req, res, next) {
  try {
    const requests = await prisma.allocation_requests.findMany({
      where: { studio_id: req.studioId },
      orderBy: { created_at: 'desc' },
    });
    res.json(requests);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getUsage,
  getProfile,
  getInvoices,
  getPlans,
  requestUpgrade,
  getAllocationRequests,
};
