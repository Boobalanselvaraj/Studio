const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const billingController = require('../controllers/billingController');
const { authenticate } = require('../middlewares/auth');
const { requireSuperAdmin } = require('../middlewares/rbac');

router.use(authenticate);
router.use(requireSuperAdmin);

// Fleet overview & Studio provisioning
router.get('/studios', adminController.listStudios);
router.post('/studios', adminController.createStudio);
router.patch('/studios/:id/billing-profile', adminController.updateStudioBilling);
router.get('/studios/:id/allocations', adminController.getStudioAllocations);
router.put('/studios/:id/allocations', adminController.updateStudioBilling);
router.patch('/studios/:id/allocations', adminController.updateStudioBilling);

// Storage connections (Platform provisioning & maintenance)
router.get('/storage-servers', adminController.listAllStorageServers);
router.post('/storage-servers', adminController.createStorageServer);
router.put('/storage-servers/:id', adminController.updateStorageServer);
router.patch('/storage-servers/:id', adminController.updateStorageServer);
router.delete('/storage-servers/:id', adminController.deleteStorageServer);
router.get('/studios/:id/storage-connections', adminController.listStudioStorageConnections);
router.post('/studios/:id/storage-connections', adminController.provisionPlatformStorage);

// Studio Invoices & Audited Manual Payments
router.get('/invoices', adminController.listAllInvoices);
router.get('/studios/:id/invoices', adminController.listStudioInvoices);
router.post('/studios/:id/invoices', adminController.generateStudioInvoice);
router.patch('/studios/:id/invoices/:invoiceId', adminController.updateStudioInvoice);
router.put('/studios/:id/invoices/:invoiceId', adminController.updateStudioInvoice);
router.delete('/studios/:id/invoices/:invoiceId', adminController.deleteStudioInvoice);
router.post('/studios/:id/invoices/:invoiceId/manual-payment', adminController.recordManualPayment);

// Studio Allocation Requests & Support Inquiries
router.get('/allocation-requests', adminController.listAllocationRequests);
router.post('/allocation-requests', adminController.createAllocationRequest);
router.patch('/allocation-requests/:id', adminController.updateAllocationRequest);
router.delete('/allocation-requests/:id', adminController.deleteAllocationRequest);
router.post('/allocation-requests/:id/resolve', adminController.resolveAllocationRequest);

// Billing Components (Versioned per-studio components)
router.get('/studios/:id/billing-components', adminController.listBillingComponents);
router.post('/studios/:id/billing-components', adminController.createBillingComponent);

// Plans
router.get('/billing-plans', billingController.getPlans);
router.post('/billing-plans', adminController.createBillingPlan);

module.exports = router;
