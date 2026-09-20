const billingRepo = require('../../repositories/billing.repository');
const db = require('../../config/db');

class BillingService {
  async getStudioBillingProfile(studioId) {
    return billingRepo.getBillingProfile(studioId);
  }

  async updateStudioBillingProfile(studioId, data) {
    return billingRepo.updateBillingProfile(studioId, data);
  }

  async getStudioUsage(studioId) {
    const profile = await billingRepo.getBillingProfile(studioId);
    const usage = await billingRepo.getLatestUsage(studioId);
    
    const quotaBytes = (profile?.storage_quota_gb || 50) * 1024 * 1024 * 1024;
    const usedBytes = parseInt(usage?.total_bytes_used || '0', 10);
    const percentUsed = quotaBytes > 0 ? (usedBytes / quotaBytes) * 100 : 0;

    return {
      quotaGb: profile?.storage_quota_gb || 50,
      usedBytes,
      usedGb: (usedBytes / (1024 * 1024 * 1024)).toFixed(2),
      percentUsed: percentUsed.toFixed(1),
      isApproachingQuota: percentUsed >= 80,
      isExceeded: percentUsed >= 100
    };
  }

  async getInvoices(studioId) {
    return billingRepo.getInvoices(studioId);
  }

  async getPlans() {
    return billingRepo.getAllPlans();
  }
}

module.exports = new BillingService();
