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
const albumRoutes = require('./albumRoutes');

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
router.patch('/customers/:id', requireStudioRole(['studio_owner', 'studio_manager']), customerController.updateCustomer);
router.delete('/customers/:id', requireStudioRole(['studio_owner', 'studio_manager']), customerController.deleteCustomer);
router.post('/customers/albums/share', requireStudioRole(['studio_owner', 'studio_manager']), customerController.shareAlbum);
router.post('/customers/albums/unshare', requireStudioRole(['studio_owner', 'studio_manager']), customerController.unshareAlbum);

// Direct Platform Allocations & Storage Usage
router.get('/allocations', billingController.getProfile);
router.all('/allocation-requests*', (req,res)=>res.status(410).json({error:'Allocation requests have been replaced by support tickets. Use /support-tickets.'}));
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
router.use('/albums', albumRoutes);
router.use('/tags', tagRoutes);
router.use('/cameras', cameraRoutes);
router.use('/storage', storageRoutes);
router.use('/billing', billingRoutes);
router.use('/shares', shareRoutes);
router.use('/upload-profiles', uploadRoutes);

const support = require('../controllers/supportController');
router.get('/support-tickets', support.list);
router.post('/support-tickets', support.create);
router.patch('/support-tickets/:id', support.update);
module.exports = router;
