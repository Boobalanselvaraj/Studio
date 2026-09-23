const {EventEmitter}=require('events');
const fs=require('fs/promises');const path=require('path');
const storageEvents=new EventEmitter();storageEvents.setMaxListeners(200);
let running=false;const observed=new Map();
async function scan(){
 if(running)return;running=true;
 try{
  const prisma=require('../config/prisma');const {ingest,cameraRoot,types}=require('./cameraIngest');
  const cameras=await prisma.cameras.findMany({where:{is_active:true,lifecycle:'ready',studio:{is_active:true}},include:{studio:true}});
  const seen=new Set();
  for(const camera of cameras){
   async function walk(dir){
    for(const entry of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])){
     const file=path.join(dir,entry.name);if(entry.isSymbolicLink())continue;
     if(entry.isDirectory()){await walk(file);continue;}
     if(!entry.isFile() || !types[path.extname(file).toLowerCase()])continue;
     seen.add(file);const stat=await fs.stat(file);const signature=stat.size+':'+stat.mtimeMs;const prior=observed.get(file);
     if(prior?.signature===signature && prior.done)continue;
     if(prior?.signature!==signature){observed.set(file,{signature,done:false});continue;}
     try{await ingest(camera,path.relative(cameraRoot(camera),file));observed.set(file,{signature,done:true});}
     catch(error){console.error('[Camera ingest]',camera.id,path.basename(file),error.message);}
    }
   }
   await walk(cameraRoot(camera));
  }
  for(const key of observed.keys())if(!seen.has(key))observed.delete(key);
 }catch(error){console.error('[Camera scan]',error.message);}finally{running=false;}
}
function startStorageWatcher(){scan();const timer=setInterval(scan,5000);timer.unref();return timer;}
module.exports={storageEvents,startStorageWatcher,scan};
