const express = require('express');
const router = express.Router();
const shareController = require('../controllers/shareController');

// Dedicated Public Endpoints (Bearer token in URL, View-Only, No Customer Account Needed)
router.get('/shares/:token', shareController.getPublicShare);
router.get('/shares/:token/assets/:id/view', shareController.servePublicAsset);
router.get('/shares/:token/live-stream', shareController.publicLiveStream);

module.exports = router;
