const express = require('express');
const router = express.Router();
const cameraController = require('../controllers/cameraController');
const { requireStudioRole } = require('../middlewares/rbac');

router.get('/', cameraController.list);
router.post('/', requireStudioRole(['studio_owner']), cameraController.create);
router.patch('/:id/status', requireStudioRole(['studio_owner']), cameraController.toggleActive);

module.exports = router;
