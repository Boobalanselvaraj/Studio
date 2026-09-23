const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');
const { authenticate } = require('../middlewares/auth');
const { requireStudioRole } = require('../middlewares/rbac');

router.post(['/', '/shares'], authenticate, requireStudioRole(['studio_owner', 'photographer']), shareController.createShare);
router.get(['/', '/shares'], authenticate, shareController.listShares);
router.delete(['/:id', '/shares/:id'], authenticate, requireStudioRole(['studio_owner']), shareController.revokeShare);

module.exports = router;
