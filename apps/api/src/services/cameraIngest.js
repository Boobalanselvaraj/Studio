const fs=require('fs');
const fsp=require('fs/promises');
const path=require('path');
const crypto=require('crypto');
const prisma=require('../config/prisma');
const env=require('../config/env');
const {writeObject}=require('./storageAdapters');
const types={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.cr3':'image/x-canon-cr3','.cr2':'image/x-canon-cr2','.nef':'image/x-nikon-nef','.arw':'image/x-sony-arw','.dng':'image/x-adobe-dng','.mp4':'video/mp4','.mov':'video/quicktime'};
function cameraRoot(camera){return path.resolve(env.STORAGE_ROOT_PATH,'studios',camera.studio.slug,'cameras',camera.sftpgo_username);}
async function ingest(camera,relative) {
  const root=await fsp.realpath(cameraRoot(camera));
  const file=await fsp.realpath(path.resolve(root,relative));
  const rel=path.relative(root,file);
  if(!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Upload path outside camera directory');
  const mime=types[path.extname(file).toLowerCase()];if(!mime) throw new Error('Unsupported photo or video format');
  const stat=await fsp.stat(file);if(!stat.isFile() || !stat.size) throw new Error('Upload is empty or incomplete');
  const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file)) hash.update(chunk);
  const digest=hash.digest('hex');
  const source='camera:'+camera.id+':'+crypto.createHash('sha256').update(rel+digest).digest('hex');
  if(await prisma.billing_events.findUnique({where:{source_key:source}})) return {status:'duplicate_event_ignored'};

  // Optional: transfer to studio-owned external storage provider
  // No provider = file indexed from local SFTP landing zone (no platform storage used)
  const provider = camera.storage_provider_id
    ? await prisma.storage_providers.findFirst({where:{id:camera.storage_provider_id,studio_id:camera.studio_id,is_enabled:true},include:{storage_credentials:true}})
    : null;

  let objectKey = camera.studio_id+'/'+camera.id+'/'+digest+'/'+path.basename(file);
  let storageProviderId = null;

  if(provider) {
    // Transfer to studio-owned storage (SFTP/S3/FTP)
    await writeObject(provider, objectKey, fs.createReadStream(file), mime);
    const after=await fsp.stat(file);
    if(after.size!==stat.size || after.mtimeMs!==stat.mtimeMs) throw new Error('Upload changed during transfer; retrying');
    storageProviderId = provider.id;
  }

  const asset=await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',camera.studio_id);
    if(await tx.billing_events.findUnique({where:{source_key:source}})) return null;
    const a=await tx.assets.create({data:{
      studio_id:camera.studio_id,
      camera_id:camera.id,
      storage_provider_id:storageProviderId,
      filename:path.basename(file),
      original_path:objectKey,
      object_key:objectKey,
      mime_type:mime,
      file_size_bytes:BigInt(stat.size),
      processing_state:'ready'
    }});
    let folder=await tx.folders.findFirst({where:{studio_id:camera.studio_id,name:'Camera — '+camera.name,parent_folder_id:null}});
    if(!folder) folder=await tx.folders.create({data:{studio_id:camera.studio_id,name:'Camera — '+camera.name}});
    await tx.folder_items.create({data:{folder_id:folder.id,item_type:'asset',item_id:a.id}});
    await tx.billing_events.create({data:{studio_id:camera.studio_id,source_key:source,meter:'camera_ingest',quantity:0}});
    if(camera.album_id){
      const album=await tx.albums.findFirst({where:{id:camera.album_id,studio_id:camera.studio_id}});
      if(album){
        await tx.album_assets.upsert({where:{album_id_asset_id:{album_id:album.id,asset_id:a.id}},create:{album_id:album.id,asset_id:a.id},update:{}});
        if(!album.cover_asset_id)await tx.albums.update({where:{id:album.id},data:{cover_asset_id:a.id}});
      }
    }
    await tx.cameras.update({where:{id:camera.id},data:{last_sync_at:new Date()}});
    return a;
  },{timeout:15000});
  if(asset) require('./storageWatcher').storageEvents.emit('media_change',{studio_id:camera.studio_id,camera_id:camera.id,asset_id:asset.id,album_id:camera.album_id});
  return {status:asset?'accepted':'duplicate_event_ignored',asset_id:asset?.id};
}
module.exports={ingest,cameraRoot,types};
