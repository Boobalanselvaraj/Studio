const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');

async function authenticate(req, res, next) {
  try {
    // 1. Check session cookie
    if (req.session && req.session.userId) {
      const userRes = await db.query('SELECT id, email, full_name, is_super_admin FROM users WHERE id = $1', [req.session.userId]);
      if (userRes.rows.length > 0) {
        req.user = userRes.rows[0];
        return next();
      }
    }

    // 2. Check Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.JWT_SECRET);
      
      const userRes = await db.query('SELECT id, email, full_name, is_super_admin FROM users WHERE id = $1', [decoded.userId]);
      if (userRes.rows.length > 0) {
        req.user = userRes.rows[0];
        return next();
      }
    }

    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid authentication credentials' });
  }
}

module.exports = {
  authenticate
};
