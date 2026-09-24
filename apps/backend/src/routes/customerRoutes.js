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

router.post('/albums/:albumId/share', async (req,res,next)=>{try {
 const grant=await require('../config/prisma').album_customers.findFirst({where:{album_id:req.params.albumId,can_share:true,customer:{user_id:req.user.id},album:{is_published:true,studio:{is_active:true}}},include:{album:true}});
 if(!grant)return res.status(403).json({error:'The studio has not enabled guest sharing for this album'});
 req.studioId=grant.album.studio_id;
 req.body={album_id:grant.album_id,expires_in_hours:72};
 return require('../controllers/shareController').createShare(req,res,next);
 }catch(e){next(e);}});
module.exports = router;
