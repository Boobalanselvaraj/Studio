const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');

router.get('/usage', billingController.getUsage);
router.get('/profile', billingController.getProfile);
router.get('/invoices', billingController.getInvoices);
router.get('/plans', billingController.getPlans);
router.post('/request-upgrade', billingController.requestUpgrade);
router.get('/requests', billingController.getAllocationRequests);

module.exports = router;
