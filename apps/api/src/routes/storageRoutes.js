const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storageController');
const { requireStudioRole } = require('../middlewares/rbac');

router.get('/providers', storageController.list);
router.post('/providers', requireStudioRole(['studio_owner']), storageController.create);
router.post('/providers/:id/test', requireStudioRole(['studio_owner']), storageController.testConnection);

module.exports = router;
