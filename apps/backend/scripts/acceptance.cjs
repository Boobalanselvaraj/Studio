const axios=require('axios'),crypto=require('crypto'),fs=require('fs'),assert=require('assert/strict');
const SFTP=require('ssh2-sftp-client');
const api=axios.create({baseURL:'http://localhost:4000/api',timeout:15000});
const filename='/usr/src/app/acceptance-credentials.json';
const state=fs.existsSync(filename)?JSON.parse(fs.readFileSync(filename)): {suffix:Date.now().toString(),password:crypto.randomBytes(18).toString('base64url')};
const save=()=>fs.writeFileSync(filename,JSON.stringify(state,null,2));save();
async function main(){
 const login=await api.post('/auth/login',{email:'admin@photostudio.io',password:'admin123456'});api.defaults.headers.Authorization='Bearer '+login.data.token;
 if(!state.studioId){const r=await api.post('/admin/studios',{name:'Acceptance Studio',slug:'acceptance-'+state.suffix,owner_email:'acceptance-'+state.suffix+'@example.test',owner_password:state.password,camera_limit:2,storage_quota_gb:1});state.studioId=r.data.id;save();}
 api.defaults.headers['x-studio-id']=state.studioId;
 const owner=await api.post('/auth/login',{email:'acceptance-'+state.suffix+'@example.test',password:state.password});api.defaults.headers.Authorization='Bearer '+owner.data.token;
 const gateway=await axios.get('http://sftpgo:8080/api/v2/token',{auth:{username:process.env.SFTPGO_ADMIN_USER,password:process.env.SFTPGO_ADMIN_PASSWORD}});
 const ga=axios.create({baseURL:'http://sftpgo:8080/api/v2',headers:{Authorization:'Bearer '+gateway.data.access_token}});
 if(!state.providerId){
  await ga.post('/users',{username:'destination_'+state.suffix,password:state.password,status:1,home_dir:'/srv/sftpgo/data/acceptance-destination-'+state.suffix,permissions:{'/':['*']}});
  const provider=await api.post('/studio/storage/providers',{name:'SFTP acceptance destination',backend:'sftp',credentials:{host:'sftpgo',port:2022,username:'destination_'+state.suffix,password:state.password,root:'/'}});state.providerId=provider.data.id;save();
 }
 await api.post('/studio/storage/providers/'+state.providerId+'/test');console.log('PASS real SFTP read/write/list/delete probe');
 if(!state.cameraId){const c=await api.post('/studio/cameras',{name:'Acceptance Camera',storage_provider_id:state.providerId,upload_username:'camera_'+state.suffix,upload_password:state.password});state.cameraId=c.data.id;save();}
 console.log('PASS camera account provisioning');
 const image=await require('sharp')({create:{width:320,height:200,channels:3,background:'#3874cb'}}).jpeg().toBuffer();
 const sftp=new SFTP();await sftp.connect({host:'sftpgo',port:2022,username:'camera_'+state.suffix,password:state.password});await sftp.put(image,'/acceptance.jpg');await sftp.end();
 let asset;
 for(let i=0;i<12;i++){const tree=(await api.get('/studio/folders/tree')).data;asset=tree.flatMap(f=>f.assets||[]).find(a=>a.filename==='acceptance.jpg');if(asset)break;await new Promise(r=>setTimeout(r,2000));}
 assert(asset,'Camera photo must appear in the library');state.assetId=asset.id;save();console.log('PASS camera upload copied to SFTP destination and visible in library');
 const download=await api.get('/studio/folders/assets/'+asset.id+'/view',{responseType:'arraybuffer'});assert.equal(crypto.createHash('sha256').update(download.data).digest('hex'),crypto.createHash('sha256').update(image).digest('hex'));console.log('PASS original download matches uploaded bytes');
 if(!state.albumId){const a=await api.post('/studio/albums',{title:'Acceptance Gallery',asset_ids:[asset.id],is_published:true});state.albumId=a.data.id;save();}
 await api.patch('/studio/cameras/'+state.cameraId+'/status',{is_active:false});
 const blocked=new SFTP();let denied=false;try{await blocked.connect({host:'sftpgo',port:2022,username:'camera_'+state.suffix,password:state.password,readyTimeout:3000});}catch{denied=true;}finally{await blocked.end().catch(()=>{});}assert(denied,'Disabled camera must not authenticate');
 await api.patch('/studio/cameras/'+state.cameraId+'/status',{is_active:true});console.log('PASS disable and re-enable gateway credentials');
 console.log('PASS acceptance flow; studio '+state.studioId+'; album '+state.albumId);
}
main().then(()=>process.exit(0)).catch(e=>{console.error('FAIL',e.response?.status,e.response?.data?.error || e.message);process.exit(1);});
