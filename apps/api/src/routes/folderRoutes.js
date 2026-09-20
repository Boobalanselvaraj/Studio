const express = require('express');
const router = express.Router();
const folderController = require('../controllers/folderController');
const { requireStudioRole } = require('../middlewares/rbac');

router.get('/tree', folderController.getTree);
router.post('/', requireStudioRole(['studio_owner', 'studio_manager']), folderController.create);
router.patch('/:id', requireStudioRole(['studio_owner', 'studio_manager']), folderController.update);
router.post('/:id/move', folderController.move);
router.post('/bulk-move', folderController.bulkMove);
router.delete('/:id', requireStudioRole(['studio_owner']), folderController.delete);

module.exports = router;
