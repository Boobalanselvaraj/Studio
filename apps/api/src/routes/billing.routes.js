const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');

router.get('/usage', billingController.getUsage);
router.get('/profile', billingController.getProfile);
router.get('/invoices', billingController.getInvoices);
router.get('/plans', billingController.getPlans);

module.exports = router;
