const express = require('express');
const router = express.Router();
const tagController = require('../controllers/tag.controller');

router.get('/', tagController.list);
router.post('/', tagController.create);
router.post('/events/:id', tagController.tagEvent);
router.post('/assets/:id', tagController.tagAsset);

module.exports = router;
