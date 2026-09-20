const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const env = require('../config/env');

async function register(req, res, next) {
  try {
    const { email, password, full_name, phone, is_super_admin = false } = req.body;

    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    const existing = await prisma.users.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return res.status(409).json({ error: 'User already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const user = await prisma.users.create({
      data: {
        email: email.toLowerCase(),
        password_hash,
        full_name,
        phone,
        is_super_admin: !!is_super_admin,
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

    res.status(201).json({
      message: 'User registered successfully',
      user,
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

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
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
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

    if (req.session) {
      req.session.userId = user.id;
      if (studios.length > 0) {
        req.session.currentStudioId = studios[0].id;
      }
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        is_super_admin: user.is_super_admin,
      },
      studios,
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res, next) {
  try {
    if (req.session) {
      req.session.destroy();
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  logout,
  me,
};
