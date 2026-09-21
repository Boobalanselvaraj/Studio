const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authenticate } = require('../middlewares/auth');
const { requireStudioRole } = require('../middlewares/rbac');

// Profiles management (Studio Admin)
router.post(['/', '/profiles'], authenticate, requireStudioRole(['studio_owner']), uploadController.createProfile);
router.get(['/', '/profiles'], authenticate, uploadController.listProfiles);
router.delete(['/:id', '/profiles/:id'], authenticate, requireStudioRole(['studio_owner']), uploadController.revokeProfile);

// Ingest Sessions (WiFi camera, Companion uploader, Studio Web Ingest)
router.post('/sessions', uploadController.authenticateUploader, uploadController.createUploadSession);
router.post('/sessions/:sessionId/file', uploadController.authenticateUploader, uploadController.uploadFileStream);
router.put('/sessions/:sessionId/file', uploadController.authenticateUploader, uploadController.uploadFileStream);

module.exports = router;
