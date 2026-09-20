const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const billingController = require('../controllers/billing.controller');
const { authenticate } = require('../middlewares/auth');
const { requireSuperAdmin } = require('../middlewares/rbac');

router.use(authenticate);
router.use(requireSuperAdmin);

router.get('/studios', adminController.listStudios);
router.post('/studios', adminController.createStudio);
router.patch('/studios/:id/billing-profile', adminController.updateStudioBilling);
router.get('/billing-plans', billingController.getPlans);

module.exports = router;
