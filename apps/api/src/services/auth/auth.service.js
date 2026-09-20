const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');
const env = require('../../config/env');

class AuthService {
  async register({ email, password, full_name, phone, is_super_admin = false }) {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      throw new Error('User already exists with this email');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO users (email, password_hash, full_name, phone, is_super_admin)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, phone, is_super_admin, created_at`,
      [email.toLowerCase(), password_hash, full_name, phone, is_super_admin]
    );

    return result.rows[0];
  }

  async login({ email, password }) {
    const result = await db.query(
      `SELECT id, email, password_hash, full_name, is_super_admin FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    // Get accessible studios
    const studiosRes = await db.query(
      `SELECT s.id, s.name, s.slug, su.role
       FROM studios s
       JOIN studio_users su ON su.studio_id = s.id
       WHERE su.user_id = $1 AND s.is_active = true`,
      [user.id]
    );

    const token = jwt.sign(
      { userId: user.id, isSuperAdmin: user.is_super_admin },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_super_admin: user.is_super_admin
      },
      studios: studiosRes.rows,
      token
    };
  }
}

module.exports = new AuthService();
