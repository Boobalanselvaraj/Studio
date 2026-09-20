const express = require('express');
const router = express.Router();
const studioController = require('../controllers/studioController');
const brandingController = require('../controllers/brandingController');
const customerController = require('../controllers/customerController');
const { authenticate } = require('../middlewares/auth');
const { resolveTenant } = require('../middlewares/tenant');
const { requireStudioRole } = require('../middlewares/rbac');

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
router.use(requireStudioRole());

router.get('/profile', studioController.getProfile);
router.get('/dashboard', studioController.getDashboardSummary);
router.get('/branding', brandingController.getBranding);
router.put('/branding', brandingController.updateBranding);
router.get('/customers', customerController.listStudioCustomers);
router.post('/customers', requireStudioRole(['studio_owner', 'studio_manager']), customerController.createCustomer);
router.post('/customers/albums/share', requireStudioRole(['studio_owner', 'studio_manager']), customerController.shareAlbum);

// Sub-modules
router.use('/events', eventRoutes);
router.use('/folders', folderRoutes);
router.use('/tags', tagRoutes);
router.use('/cameras', cameraRoutes);
router.use('/storage', storageRoutes);
router.use('/billing', billingRoutes);

module.exports = router;
