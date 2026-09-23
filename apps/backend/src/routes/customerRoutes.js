const router = require('express').Router();
const controller = require('../controllers/customerController');
const { authenticate } = require('../middlewares/auth');
const { privateLiveStream } = require('../services/mediaAccess');
router.use(authenticate);
router.get('/assets/:id/view', controller.serveCustomerAsset);
router.get('/assets/:id/download', (req, res, next) => {
  req.query.download = 'true';
  return controller.serveCustomerAsset(req, res, next);
});
router.get('/albums/live-stream', privateLiveStream);
router.get('/albums', controller.getMyGalleries);
router.get('/albums/:id', controller.getAlbumById);
router.get('/albums/:albumId/download', controller.downloadAlbumZip);
router.post('/albums/:albumId/assets/:assetId/favorite', controller.toggleFavorite);

module.exports = router;
