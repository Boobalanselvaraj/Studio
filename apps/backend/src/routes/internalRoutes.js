const express = require('express');
const router = express.Router();
const internalController = require('../controllers/internalController');

// Gateway upload webhook (internal, authenticated, replay-protected)
router.post('/ingest-events', internalController.handleIngestEvent);

module.exports = router;
