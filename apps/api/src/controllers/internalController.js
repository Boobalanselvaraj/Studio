const crypto=require('crypto');
const prisma=require('../config/prisma');const env=require('../config/env');
async function handleIngestEvent(req,res,next){try{
 const expected=env.INTERNAL_SERVICE_KEY;const actual=req.headers['x-internal-token'];
 if(!expected || typeof actual!=='string' || Buffer.byteLength(expected)!==Buffer.byteLength(actual) || !crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(actual)))return res.status(401).json({error:'Unauthorized internal service request'});
 const {username,virtual_path,filename}=req.body;
 if(typeof username!=='string' || typeof (virtual_path || filename)!=='string')return res.status(400).json({error:'username and upload path are required'});
 const camera=await prisma.cameras.findFirst({where:{sftpgo_username:username,is_active:true,lifecycle:'ready',studio:{is_active:true}},include:{studio:true}});
 if(!camera)return res.status(403).json({error:'Active camera not found'});
 const result=await require('../services/cameraIngest').ingest(camera,(virtual_path || filename).replace(/^\/+/,''));
 res.json(result);
 }catch(error){next(error);}}
module.exports={handleIngestEvent};
