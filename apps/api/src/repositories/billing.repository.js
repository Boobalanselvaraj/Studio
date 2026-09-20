const prisma = require('../config/prisma');

class BillingRepository {
  async getBillingProfile(studio_id) {
    return prisma.studio_billing_profile.findUnique({
      where: { studio_id },
      include: {
        billing_plan: true,
      },
    });
  }

  async updateBillingProfile(studio_id, data) {
    const { storage_quota_gb, billing_plan_id, custom_price_per_month, billing_status } = data;
    return prisma.studio_billing_profile.upsert({
      where: { studio_id },
      create: {
        studio_id,
        storage_quota_gb: storage_quota_gb || 50,
        billing_plan_id,
        custom_price_per_month,
        billing_status: billing_status || 'active',
      },
      update: {
        storage_quota_gb: storage_quota_gb !== undefined ? storage_quota_gb : undefined,
        billing_plan_id: billing_plan_id !== undefined ? billing_plan_id : undefined,
        custom_price_per_month: custom_price_per_month !== undefined ? custom_price_per_month : undefined,
        billing_status: billing_status !== undefined ? billing_status : undefined,
        updated_at: new Date(),
      },
      include: {
        billing_plan: true,
      },
    });
  }

  async getLatestUsage(studio_id) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const aggregate = await prisma.storage_usage_snapshots.aggregate({
      where: {
        studio_id,
        snapshot_date: {
          gte: today,
        },
      },
      _sum: {
        bytes_used: true,
      },
    });

    return {
      total_bytes_used: aggregate._sum.bytes_used ? aggregate._sum.bytes_used.toString() : '0',
    };
  }

  async getInvoices(studio_id) {
    return prisma.invoices.findMany({
      where: { studio_id },
      orderBy: { period_end: 'desc' },
    });
  }

  async getAllPlans() {
    return prisma.billing_plans.findMany({
      where: { is_active: true },
      orderBy: { storage_gb_min: 'asc' },
    });
  }
}

module.exports = new BillingRepository();
