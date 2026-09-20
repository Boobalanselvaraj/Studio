const db = require('../../config/db');

class CustomerService {
  async getCustomers(studioId) {
    const query = `
      SELECT c.*, u.email, u.full_name, u.phone,
        COUNT(DISTINCT ec.event_id) as total_events,
        COUNT(DISTINCT ac.album_id) as total_albums
      FROM customers c
      JOIN users u ON u.id = c.user_id
      LEFT JOIN event_customers ec ON ec.customer_id = c.id
      LEFT JOIN album_customers ac ON ac.customer_id = c.id
      WHERE c.studio_id = $1
      GROUP BY c.id, u.id
      ORDER BY c.created_at DESC
    `;
    const result = await db.query(query, [studioId]);
    return result.rows;
  }

  async getCustomerAlbums(customerId) {
    const query = `
      SELECT a.*, s.name as studio_name, sb.brand_name, sb.logo_url, sb.primary_color
      FROM albums a
      JOIN album_customers ac ON ac.album_id = a.id
      JOIN studios s ON s.id = a.studio_id
      LEFT JOIN studio_branding sb ON sb.studio_id = s.id
      WHERE ac.customer_id = $1 AND a.is_published = true
      ORDER BY a.created_at DESC
    `;
    const result = await db.query(query, [customerId]);
    return result.rows;
  }
}

module.exports = new CustomerService();
