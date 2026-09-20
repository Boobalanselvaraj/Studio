const axios = require('axios');
const env = require('./env');

const SFTPGO_ADMIN_USER = process.env.SFTPGO_DEFAULT_ADMIN_USERNAME || 'admin';
const SFTPGO_ADMIN_PASS = process.env.SFTPGO_DEFAULT_ADMIN_PASSWORD || 'password123';
const SFTPGO_URL = env.SFTPGO_API_URL.replace(/\/api\/v2\/?$/, '');

async function getAdminToken() {
  try {
    const authHeader = 'Basic ' + Buffer.from(`${SFTPGO_ADMIN_USER}:${SFTPGO_ADMIN_PASS}`).toString('base64');
    const res = await axios.get(`${SFTPGO_URL}/api/v2/token`, {
      headers: {
        Authorization: authHeader,
      },
      timeout: 5000,
    });
    return res.data?.access_token || null;
  } catch (err) {
    console.warn('[SFTPGo] Could not obtain admin token:', err.message);
    return null;
  }
}

async function provisionSftpgoUser(username, password) {
  try {
    const token = await getAdminToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const payload = {
      username,
      password,
      status: 1,
      permissions: {
        '/': ['*'],
      },
      home_dir: `/srv/sftpgo/data/${username}`,
    };

    const res = await axios.post(`${SFTPGO_URL}/api/v2/users`, payload, {
      headers,
      timeout: 5000,
    });

    console.log(`[SFTPGo] Successfully auto-provisioned SFTPGo user: ${username}`);
    return res.data;
  } catch (err) {
    if (err.response?.status === 409 || err.response?.data?.message?.includes('already exists')) {
      console.log(`[SFTPGo] User ${username} already exists in SFTPGo.`);
      return { status: 'exists' };
    }
    console.warn(`[SFTPGo] Auto-provisioning note (${username}):`, err.response?.data?.error || err.message);
    return null;
  }
}

module.exports = {
  getAdminToken,
  provisionSftpgoUser,
};
