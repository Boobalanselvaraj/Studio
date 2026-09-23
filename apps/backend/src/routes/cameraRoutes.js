const express = require('express');
const router = express.Router();
const cameraController = require('../controllers/cameraController');
const { requireStudioRole } = require('../middlewares/rbac');

router.get('/', cameraController.list);
router.post('/', requireStudioRole(['studio_owner']), cameraController.create);
router.patch('/:id/status', requireStudioRole(['studio_owner']), cameraController.toggleActive);
router.post('/:id/retire', requireStudioRole(['studio_owner']), cameraController.retire);

router.delete('/:id', requireStudioRole(['studio_owner']), cameraController.delete);
router.patch('/:id/album', requireStudioRole(['studio_owner','studio_manager']), cameraController.assignAlbum);
router.get('/:id/assets', cameraController.getCameraAssets);
router.post('/:id/upload', cameraController.uploadCameraPhoto);

module.exports = router;
