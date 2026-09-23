const express = require('express');
const router = express.Router();
const storageController = require('../controllers/storageController');
const { requireStudioRole } = require('../middlewares/rbac');

router.get('/', storageController.list);
router.get('/providers', storageController.list);
router.post('/', requireStudioRole(['studio_owner']), storageController.create);
router.post('/providers', requireStudioRole(['studio_owner']), storageController.create);
router.post('/:id/test', requireStudioRole(['studio_owner']), storageController.testConnection);
router.post('/providers/:id/test', requireStudioRole(['studio_owner']), storageController.testConnection);
router.put('/:id', requireStudioRole(['studio_owner']), storageController.update);
router.put('/providers/:id', requireStudioRole(['studio_owner']), storageController.update);
router.delete('/:id', requireStudioRole(['studio_owner']), storageController.remove);
router.delete('/providers/:id', requireStudioRole(['studio_owner']), storageController.remove);

module.exports = router;
