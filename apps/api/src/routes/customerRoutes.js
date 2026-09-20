const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

router.get('/albums', customerController.getMyGalleries);

module.exports = router;
