const BaseRepository = require('./base.repository');
const db = require('../config/db');

class BillingRepository {
  async getBillingProfile(studioId) {
    const query = `
      SELECT bp.*, p.name as plan_name, p.price_per_month as plan_price
      FROM studio_billing_profile bp
      LEFT JOIN billing_plans p ON p.id = bp.billing_plan_id
      WHERE bp.studio_id = $1
    `;
    const result = await db.query(query, [studioId]);
    return result.rows[0] || null;
  }

  async updateBillingProfile(studioId, data) {
    const { storage_quota_gb, billing_plan_id, custom_price_per_month, billing_status } = data;
    const result = await db.query(
      `INSERT INTO studio_billing_profile (studio_id, storage_quota_gb, billing_plan_id, custom_price_per_month, billing_status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (studio_id) DO UPDATE SET
         storage_quota_gb = COALESCE(EXCLUDED.storage_quota_gb, studio_billing_profile.storage_quota_gb),
         billing_plan_id = COALESCE(EXCLUDED.billing_plan_id, studio_billing_profile.billing_plan_id),
         custom_price_per_month = EXCLUDED.custom_price_per_month,
         billing_status = COALESCE(EXCLUDED.billing_status, studio_billing_profile.billing_status),
         updated_at = NOW()
       RETURNING *`,
      [studioId, storage_quota_gb || 50, billing_plan_id, custom_price_per_month, billing_status || 'active']
    );
    return result.rows[0];
  }

  async getLatestUsage(studioId) {
    const query = `
      SELECT COALESCE(SUM(bytes_used), 0) as total_bytes_used
      FROM storage_usage_snapshots
      WHERE studio_id = $1 AND snapshot_date = CURRENT_DATE
    `;
    const result = await db.query(query, [studioId]);
    return result.rows[0];
  }

  async getInvoices(studioId) {
    const query = `SELECT * FROM invoices WHERE studio_id = $1 ORDER BY period_end DESC`;
    const result = await db.query(query, [studioId]);
    return result.rows;
  }

  async getAllPlans() {
    const query = `SELECT * FROM billing_plans WHERE is_active = true ORDER BY storage_gb_min ASC`;
    const result = await db.query(query);
    return result.rows;
  }
}

module.exports = new BillingRepository();
