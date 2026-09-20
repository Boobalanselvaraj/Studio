const express = require('express');
const router = express.Router();
const studioController = require('../controllers/studioController');
const brandingController = require('../controllers/brandingController');
const customerController = require('../controllers/customerController');
const { authenticate } = require('../middlewares/auth');
const { resolveTenant } = require('../middlewares/tenant');

// Sub-module route imports
const eventRoutes = require('./eventRoutes');
const folderRoutes = require('./folderRoutes');
const tagRoutes = require('./tagRoutes');
const cameraRoutes = require('./cameraRoutes');
const storageRoutes = require('./storageRoutes');
const billingRoutes = require('./billingRoutes');

// Tenant Guard
router.use(authenticate);
router.use(resolveTenant);

router.get('/profile', studioController.getProfile);
router.get('/dashboard', studioController.getDashboardSummary);
router.get('/branding', brandingController.getBranding);
router.put('/branding', brandingController.updateBranding);
router.get('/customers', customerController.listStudioCustomers);

// Sub-modules
router.use('/events', eventRoutes);
router.use('/folders', folderRoutes);
router.use('/tags', tagRoutes);
router.use('/cameras', cameraRoutes);
router.use('/storage', storageRoutes);
router.use('/billing', billingRoutes);

module.exports = router;
