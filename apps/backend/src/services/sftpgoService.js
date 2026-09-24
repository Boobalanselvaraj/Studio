const axios = require('axios');
const env = require('../config/env');
const base = process.env.SFTPGO_HOST || env.SFTPGO_API_URL.replace(/\/api\/v2\/?$/, '');

async function client() {
  try {
    const { data } = await axios.get(base + '/api/v2/token', {
      auth: {
        username: process.env.SFTPGO_ADMIN_USER || 'admin',
        password: process.env.SFTPGO_ADMIN_PASSWORD || 'password123',
      },
      timeout: 3000,
    });
    if (!data.access_token) throw new Error('Missing gateway token');
    return axios.create({
      baseURL: base + '/api/v2',
      headers: { Authorization: 'Bearer ' + data.access_token },
      timeout: 5000,
    });
  } catch (err) {
    console.warn('[SFTPGo] Gateway connection note:', err.message);
    throw new Error('SFTP gateway is unavailable or administrator authentication failed');
  }
}

async function provisionCameraUser({ username, password, studioSlug, cameraId }) {
  try {
    const api = await client();
    const payload = {
      status: 1,
      username,
      password,
      home_dir: '/srv/sftpgo/data/' + (studioSlug || 'studio') + '/cameras/' + username,
      permissions: { '/': ['list', 'upload', 'overwrite', 'rename', 'create_dirs', 'delete', 'download'] },
      description: 'Studio camera ' + cameraId,
    };
    const { data } = await api.post('/users', payload);
    return { status: 'provisioned', sftpgo_username: data.username, home_dir: data.home_dir };
  } catch (err) {
    console.warn(`[SFTPGo] Could not provision user '${username}' on remote gateway (${err.message}).`);
    throw new Error('SFTP user provisioning failed: ' + (err.response?.data?.message || err.message));
  }
}

async function setCameraActive({ username, active }) {
  try {
    const api = await client();
    if (!api) return { status: active ? 'enabled' : 'disabled', sftpgo_username: username };
    const endpoint = '/users/' + encodeURIComponent(username);
    const { data } = await api.get(endpoint);
    await api.put(endpoint, { ...data, status: active ? 1 : 0 });
    return { status: active ? 'enabled' : 'disabled', sftpgo_username: username };
  } catch (err) {
    throw new Error('Could not update SFTP gateway user status');
  }
}

async function deleteCameraUser({ username }) {
  try {
    const api = await client();
    if (!api) return { status: 'deleted_local', sftpgo_username: username };
    const endpoint = '/users/' + encodeURIComponent(username);
    await api.delete(endpoint);
    return { status: 'deleted', sftpgo_username: username };
  } catch (err) {
    console.warn(`[SFTPGo] deleteCameraUser notice for '${username}':`, err.message);
    return { status: 'deleted_fallback', sftpgo_username: username };
  }
}

async function repairCameraUser({username,password,studioSlug,cameraId,active}) {
 const api=await client();const endpoint='/users/'+encodeURIComponent(username);
 let current;
 try{current=(await api.get(endpoint)).data;}catch(e){if(e.response?.status!==404)throw e;}
 if(current && current.description !== 'Studio camera '+cameraId)throw new Error('Gateway username belongs to another resource; contact administrator');
 const payload={...(current||{}),username,password,status:active?1:0,home_dir:'/srv/sftpgo/data/'+studioSlug+'/cameras/'+username,permissions:{'/':['list','upload','overwrite','rename','create_dirs','delete','download']},description:'Studio camera '+cameraId};
 if(current)await api.put(endpoint,payload);else await api.post('/users',payload);
}
const retireCameraUser = ({ username }) => setCameraActive({ username, active: false });

module.exports = {
  provisionCameraUser,
  repairCameraUser,
  retireCameraUser,
  setCameraActive,
  deleteCameraUser,
};
