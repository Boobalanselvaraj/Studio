const prisma = require('../config/prisma');
const statuses = ['open','in_progress','waiting','resolved','closed'];
const categories = ['general','camera','upload','gallery','account','billing','bug'];
const priorities = ['low','normal','high','urgent'];
const scope = req => req.studioId ? {studio_id:req.studioId} : {};
exports.list = async (req,res,next) => {try {
 const tickets=await prisma.support_tickets.findMany({where:scope(req),orderBy:{updated_at:'desc'}});
 const studios=await prisma.studios.findMany({where:{id:{in:[...new Set(tickets.map(t=>t.studio_id))]}},select:{id:true,name:true}});
 res.json(tickets.map(t=>({...t,studio:studios.find(s=>s.id===t.studio_id)})));
} catch(e){next(e);}};
exports.create = async (req,res,next) => {try {
 const {subject,description,category='general',priority='normal'}=req.body;
 const studioId=req.studioId || req.body.studio_id;
 if(typeof subject!=='string'||!subject.trim()||subject.length>200||typeof description!=='string'||!description.trim()||description.length>10000||!categories.includes(category)||!priorities.includes(priority)) return res.status(400).json({error:'Enter a subject, issue description, valid category and priority'});
 if(!studioId || !await prisma.studios.findUnique({where:{id:studioId}}))return res.status(404).json({error:'Studio not found'});
 res.status(201).json(await prisma.support_tickets.create({data:{studio_id:studioId,created_by:req.user.id,subject:subject.trim(),description:description.trim(),category,priority}}));
} catch(e){next(e);}};
exports.update = async (req,res,next) => {try {
 const existing=await prisma.support_tickets.findFirst({where:{id:req.params.id,...scope(req)}});
 if(!existing)return res.status(404).json({error:'Ticket not found'});
 const {status,priority,resolution}=req.body;
 if((status!==undefined&&!statuses.includes(status))||(priority!==undefined&&!priorities.includes(priority))||(resolution!==undefined&&(typeof resolution!=='string'||resolution.length>10000)))return res.status(400).json({error:'Invalid ticket update'});
 res.json(await prisma.support_tickets.update({where:{id:existing.id},data:{status,priority,resolution}}));
} catch(e){next(e);}};
