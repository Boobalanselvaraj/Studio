const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storage.controller');
const { requireStudioRole } = require('../middlewares/rbac');

router.get('/providers', storageController.list);
router.post('/providers', requireStudioRole(['studio_owner']), storageController.create);

module.exports = router;
