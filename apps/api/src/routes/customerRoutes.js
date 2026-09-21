const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate } = require('../middlewares/auth');
const { storageEvents } = require('../services/storageWatcher');

// Public / Gallery media view
router.get('/assets/:id/view', customerController.serveCustomerAsset);

// Real-time live SSE stream for customer galleries
router.get('/albums/live-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (res.flushHeaders) res.flushHeaders();

  res.write(`data: ${JSON.stringify({ event: 'connected', time: new Date().toISOString() })}\n\n`);

  const onMediaChange = (payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  storageEvents.on('media_change', onMediaChange);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    storageEvents.removeListener('media_change', onMediaChange);
  });
});

// Authenticated customer/studio access
router.use(authenticate);
router.get('/albums', customerController.getMyGalleries);
router.get('/albums/:id', customerController.getAlbumById);

module.exports = router;
