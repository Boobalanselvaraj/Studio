const env = require('../../config/env');

class SFTPGoService {
  async createUser({ username, password, home_dir }) {
    // Integration stub with SFTPGo REST API
    console.log(`[SFTPGo Service] Provisioning user ${username} with home dir ${home_dir}`);
    return {
      status: 201,
      username,
      home_dir,
      permissions: { '/': ['*'] }
    };
  }

  async deleteUser(username) {
    console.log(`[SFTPGo Service] Removing user ${username}`);
    return { status: 200, message: 'User deleted' };
  }
}

module.exports = new SFTPGoService();
