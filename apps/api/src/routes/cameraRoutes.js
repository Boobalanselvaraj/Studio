const express = require('express');
const router = express.Router();
const cameraController = require('../controllers/cameraController');
const { requireStudioRole } = require('../middlewares/rbac');

router.get('/', cameraController.list);
router.post('/', requireStudioRole(['studio_owner']), cameraController.create);
router.patch('/:id/status', requireStudioRole(['studio_owner']), cameraController.toggleActive);
router.post('/:id/retire', requireStudioRole(['studio_owner']), cameraController.retire);

module.exports = router;
