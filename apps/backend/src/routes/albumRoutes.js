const express = require('express');
const router = express.Router();
const albumController = require('../controllers/albumController');
const { requireStudioRole } = require('../middlewares/rbac');

router.get('/', albumController.listAlbums);
router.post('/', requireStudioRole(['studio_owner', 'studio_manager', 'photographer']), albumController.createAlbum);
router.get('/:id', albumController.getAlbumById);
router.patch('/:id', requireStudioRole(['studio_owner', 'studio_manager']), albumController.updateAlbum);
router.delete('/:id', requireStudioRole(['studio_owner', 'studio_manager']), albumController.deleteAlbum);
router.get('/:id/download', albumController.downloadAlbumZip);
router.post('/:id/assets', requireStudioRole(['studio_owner', 'studio_manager', 'photographer']), albumController.addAssetsToAlbum);
router.delete('/:id/assets/:assetId', requireStudioRole(['studio_owner', 'studio_manager', 'photographer']), albumController.removeAssetFromAlbum);

module.exports = router;
