const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/prisma');

async function authenticate(req, res, next) {
  try {
    // 1. Check session cookie
    if (req.session && req.session.userId) {
      const user = await prisma.users.findUnique({
        where: { id: req.session.userId },
        select: { id: true, email: true, full_name: true, is_super_admin: true },
      });
      if (user) {
        req.user = user;
        return next();
      }
    }

    // 2. Check Authorization Bearer header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, env.JWT_SECRET);
      
      const user = await prisma.users.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, full_name: true, is_super_admin: true },
      });
      if (user) {
        req.user = user;
        return next();
      }
    }

    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid authentication credentials' });
  }
}

module.exports = {
  authenticate,
};
