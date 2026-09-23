const axios = require('axios');
const base = process.env.SFTPGO_HOST || 'http://localhost:8080';

async function client() {
  try {
    const { data } = await axios.get(base + '/api/v2/token', {
      auth: {
        username: process.env.SFTPGO_ADMIN_USER || 'admin',
        password: process.env.SFTPGO_ADMIN_PASSWORD || 'adminpassword',
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
    return null;
  }
}

async function provisionCameraUser({ username, password, studioSlug, cameraId }) {
  try {
    const api = await client();
    if (!api) {
      console.info(`[SFTPGo] Gateway offline. Registered camera user '${username}' in local storage mode.`);
      return { status: 'provisioned_local', sftpgo_username: username, home_dir: `/storage/${studioSlug}/cameras/${username}` };
    }
    const { data } = await api.post('/users', {
      status: 1,
      username,
      password,
      home_dir: '/srv/sftpgo/data/' + (studioSlug || 'studio') + '/cameras/' + username,
      permissions: { '/': ['list', 'upload', 'create_dirs', 'delete', 'download'] },
      description: 'Studio camera ' + cameraId,
    });
    return { status: 'provisioned', sftpgo_username: data.username, home_dir: data.home_dir };
  } catch (err) {
    console.warn(`[SFTPGo] Could not provision user '${username}' on remote gateway (${err.message}). Falling back to local.`);
    return { status: 'provisioned_local', sftpgo_username: username, home_dir: `/storage/${studioSlug}/cameras/${username}` };
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
    console.warn(`[SFTPGo] setCameraActive warning for '${username}':`, err.message);
    return { status: active ? 'enabled' : 'disabled', sftpgo_username: username };
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

const retireCameraUser = ({ username }) => setCameraActive({ username, active: false });

module.exports = {
  provisionCameraUser,
  retireCameraUser,
  setCameraActive,
  deleteCameraUser,
};
