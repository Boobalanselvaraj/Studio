const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');
const env = require('../../config/env');

class AuthService {
  async register({ email, password, full_name, phone, is_super_admin = false }) {
    const existing = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing) {
      throw new Error('User already exists with this email');
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await prisma.users.create({
      data: {
        email: email.toLowerCase(),
        password_hash,
        full_name,
        phone,
        is_super_admin,
      },
      select: {
        id: true,
        email: true,
        full_name: true,
        phone: true,
        is_super_admin: true,
        created_at: true,
      },
    });

    return user;
  }

  async login({ email, password }) {
    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        studio_users: {
          include: {
            studio: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid email or password');
    }

    const studios = user.studio_users
      .filter((su) => su.studio.is_active)
      .map((su) => ({
        id: su.studio.id,
        name: su.studio.name,
        slug: su.studio.slug,
        role: su.role,
      }));

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
        is_super_admin: user.is_super_admin,
      },
      studios,
      token,
    };
  }
}

module.exports = new AuthService();
