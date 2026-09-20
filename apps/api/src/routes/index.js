const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const studioRoutes = require('./studio.routes');
const adminRoutes = require('./admin.routes');
const customerRoutes = require('./customer.routes');

// System health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'photo-studio-api'
  });
});

// Zone Route Mounts
router.use('/auth', authRoutes);
router.use('/studio', studioRoutes);
router.use('/admin', adminRoutes);
router.use('/customer', customerRoutes);

module.exports = router;
