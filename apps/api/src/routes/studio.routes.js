const express = require('express');
const router = express.Router();
const studioController = require('../controllers/studio.controller');
const brandingController = require('../controllers/branding.controller');
const customerController = require('../controllers/customer.controller');
const { authenticate } = require('../middlewares/auth');
const { resolveTenant } = require('../middlewares/tenant');

// Sub-domain / Tenant routes
const eventRoutes = require('./event.routes');
const folderRoutes = require('./folder.routes');
const tagRoutes = require('./tag.routes');
const cameraRoutes = require('./camera.routes');
const storageRoutes = require('./storage.routes');
const billingRoutes = require('./billing.routes');

// All studio routes require authentication and tenant resolution
router.use(authenticate);
router.use(resolveTenant);

router.get('/profile', studioController.getProfile);
router.get('/dashboard', studioController.getDashboardSummary);
router.get('/branding', brandingController.getBranding);
router.put('/branding', brandingController.updateBranding);
router.get('/customers', customerController.listStudioCustomers);

// Mount nested modules
router.use('/events', eventRoutes);
router.use('/folders', folderRoutes);
router.use('/tags', tagRoutes);
router.use('/cameras', cameraRoutes);
router.use('/storage', storageRoutes);
router.use('/billing', billingRoutes);

module.exports = router;
