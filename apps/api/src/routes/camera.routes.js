const express = require('express');
const router = express.Router();
const cameraController = require('../controllers/camera.controller');
const { requireStudioRole } = require('../middlewares/rbac');

router.get('/', cameraController.list);
router.post('/', requireStudioRole(['studio_owner']), cameraController.create);

module.exports = router;
