const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tagController');

router.get('/', tagController.list);
router.post('/', tagController.create);
router.post('/events/:id', tagController.tagEvent);
router.post('/assets/:id', tagController.tagAsset);
router.get('/assets/:id/suggested-tags', tagController.getSuggestedTags);

module.exports = router;
