const express = require('express');
const router = express.Router();
const studioController = require('../controllers/studioController');
const brandingController = require('../controllers/brandingController');
const customerController = require('../controllers/customerController');
const billingController = require('../controllers/billingController');
const shareController = require('../controllers/shareController');
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
const shareRoutes = require('./shareRoutes');
const uploadRoutes = require('./uploadRoutes');

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

// Direct Platform Allocations & Storage Usage
router.get('/allocations', billingController.getProfile);
router.get('/allocation-requests', billingController.getAllocationRequests);
router.post('/allocation-requests', billingController.requestUpgrade);
router.get('/storage-usage', billingController.getUsage);

// Direct Album Public Shares
router.get('/albums/:id/shares', (req, res, next) => {
  req.query.album_id = req.params.id;
  return shareController.listShares(req, res, next);
});
router.post('/albums/:id/shares', requireStudioRole(['studio_owner', 'photographer']), (req, res, next) => {
  req.body.album_ids = [req.params.id];
  return shareController.createShare(req, res, next);
});

// Sub-modules
router.use('/events', eventRoutes);
router.use('/folders', folderRoutes);
router.use('/tags', tagRoutes);
router.use('/cameras', cameraRoutes);
router.use('/storage', storageRoutes);
router.use('/billing', billingRoutes);
router.use('/shares', shareRoutes);
router.use('/upload-profiles', uploadRoutes);

module.exports = router;
