const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const studioRoutes = require('./studioRoutes');
const adminRoutes = require('./adminRoutes');
const customerRoutes = require('./customerRoutes');
const publicRoutes = require('./publicRoutes');
const uploadRoutes = require('./uploadRoutes');
const internalRoutes = require('./internalRoutes');

// System health check
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'photo-studio-api',
  });
});

// Zone Route Mounts
router.use('/auth', authRoutes);
router.use('/studio', studioRoutes);
router.use('/admin', adminRoutes);
router.use('/customer', customerRoutes);
router.use('/public', publicRoutes);
router.use('/uploads', uploadRoutes);
router.use('/internal', internalRoutes);

module.exports = router;
