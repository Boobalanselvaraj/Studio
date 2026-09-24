const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const { requireStudioRole } = require('../middlewares/rbac');

router.patch('/assets/:id', requireStudioRole(['studio_owner','studio_manager']), folderController.updateAsset);
router.delete('/assets/:id', requireStudioRole(['studio_owner','studio_manager']), folderController.deleteAsset);
router.post('/:id/assets', requireStudioRole(['studio_owner','studio_manager','photographer']), folderController.addFolderAssets);
router.get('/tree', folderController.getTree);
router.get('/server-explorer', folderController.getServerExplorerData);
router.post('/batch-assign', requireStudioRole(['studio_owner', 'studio_manager', 'photographer']), folderController.batchAssignAssets);
router.post('/sync-storage', folderController.syncStorage);
router.get('/assets/:id/view', folderController.serveAsset);
router.post('/', requireStudioRole(['studio_owner', 'studio_manager']), folderController.create);
router.patch('/:id', requireStudioRole(['studio_owner', 'studio_manager']), folderController.update);
router.post('/:id/move', folderController.move);
router.post('/:id/publish-gallery', requireStudioRole(['studio_owner', 'studio_manager']), folderController.publishGallery);
router.post('/bulk-move', folderController.bulkMove);
router.delete('/:id', requireStudioRole(['studio_owner']), folderController.delete);

module.exports = router;
