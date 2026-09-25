const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');

router.get('/usage', billingController.getUsage);
router.get('/profile', billingController.getProfile);
router.get('/invoices', billingController.getInvoices);
router.get('/subscriptions', billingController.getSubscriptions);
router.get('/plans', billingController.getPlans);
router.all('/request-upgrade', (req,res)=>res.status(410).json({error:'Allocation requests have been replaced by support tickets. Use /support-tickets.'}));
router.get('/requests', (req,res)=>res.status(410).json({error:'Use /studio/support-tickets for issue tracking.'}));

module.exports = router;
