const axios=require('axios'),fs=require('fs'),assert=require('assert/strict');
const state=JSON.parse(fs.readFileSync('/usr/src/app/acceptance-credentials.json'));
const api=axios.create({baseURL:'http://127.0.0.1:4000/api',timeout:15000});
async function main(){
 const owner=(await api.post('/auth/login',{email:'acceptance-'+state.suffix+'@example.test',password:state.password})).data;
 api.defaults.headers.Authorization='Bearer '+owner.token;api.defaults.headers['x-studio-id']=state.studioId;
 if(!state.customerId){
  await api.post('/auth/register',{email:'client-'+state.suffix+'@example.test',password:state.password,full_name:'Acceptance Client'});
  const c=await api.post('/studio/customers',{email:'client-'+state.suffix+'@example.test',full_name:'Acceptance Client'});state.customerId=c.data.id;fs.writeFileSync('/usr/src/app/acceptance-credentials.json',JSON.stringify(state,null,2));
 }
 await api.post('/studio/customers/albums/share',{album_id:state.albumId,customer_id:state.customerId,can_download:true,can_favorite:true});
 const login=await api.post('/auth/login',{email:'client-'+state.suffix+'@example.test',password:state.password});
 const client=axios.create({baseURL:api.defaults.baseURL,headers:{Authorization:'Bearer '+login.data.token},timeout:15000});
 assert.equal((await client.get('/customer/albums/'+state.albumId)).data.id,state.albumId);console.log('PASS customer sees published shared gallery');
 const zip=await client.get('/customer/albums/'+state.albumId+'/download',{responseType:'arraybuffer'});assert.equal(zip.data.subarray(0,2).toString(),'PK');assert(zip.data.length>200);console.log('PASS ZIP streams SFTP originals');
 const favorite=await client.post('/customer/albums/'+state.albumId+'/assets/'+state.assetId+'/favorite',{is_favorite:true});assert.equal(favorite.data.is_favorite,true);console.log('PASS customer favorites');
 await api.post('/studio/customers/albums/share',{album_id:state.albumId,customer_id:state.customerId,can_download:false,can_favorite:false});
 for(const [method,url] of [['get','/customer/albums/'+state.albumId+'/download'],['get','/customer/assets/'+state.assetId+'/download'],['post','/customer/albums/'+state.albumId+'/assets/'+state.assetId+'/favorite']]){const r=await client.request({method,url,validateStatus:()=>true});assert(r.status===403||r.status===404);}
 console.log('PASS download and favorite revocation enforced');
 await api.post('/studio/customers/albums/share',{album_id:state.albumId,customer_id:state.customerId,can_download:true,can_favorite:true});
 await api.patch('/studio/cameras/'+state.cameraId+'/album',{album_id:state.albumId});
 const SFTP=require('ssh2-sftp-client'),sftp=new SFTP();await sftp.connect({host:'sftpgo',port:2022,username:'camera_'+state.suffix,password:state.password});
 const photo=await require('sharp')({create:{width:200,height:150,channels:3,background:'#cd7632'}}).jpeg().toBuffer();const shot='live-'+Date.now()+'.jpg';await sftp.put(photo,'/'+shot);await sftp.end();
 let found=false;for(let i=0;i<12;i++){const a=(await client.get('/customer/albums/'+state.albumId)).data;found=a.assets.some(x=>x.filename===shot);if(found)break;await new Promise(r=>setTimeout(r,2000));}assert(found);console.log('PASS new camera photo automatically appears in assigned customer album');
 const forbidden=await axios.get(api.defaults.baseURL+'/customer/albums/'+state.albumId,{validateStatus:()=>true});assert.equal(forbidden.status,401);console.log('PASS unauthenticated gallery blocked');
}
main().then(()=>process.exit(0)).catch(e=>{console.error('FAIL',e.response?.status,e.response?.data?.error||e.message);process.exit(1)});
