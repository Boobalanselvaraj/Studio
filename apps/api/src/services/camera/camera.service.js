const db = require('../../config/db');
const sftpgoService = require('../sftpgo/sftpgo.service');

class CameraService {
  async getCameras(studioId) {
    const result = await db.query(
      `SELECT id, studio_id, name, model, sftpgo_username, is_active, last_sync_at, created_at 
       FROM cameras WHERE studio_id = $1 ORDER BY created_at DESC`,
      [studioId]
    );
    return result.rows;
  }

  async createCamera(studioId, { name, model, sftpgo_username, sftpgo_password }) {
    // 1. Provision SFTPGo User
    await sftpgoService.createUser({
      username: sftpgo_username,
      password: sftpgo_password,
      home_dir: `/srv/sftpgo/data/${studioId}/cameras/${sftpgo_username}`
    });

    // 2. Save in database
    const result = await db.query(
      `INSERT INTO cameras (studio_id, name, model, sftpgo_username, sftpgo_password_hash)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, studio_id, name, model, sftpgo_username, is_active, created_at`,
      [studioId, name, model, sftpgo_username, 'masked_hash']
    );

    return result.rows[0];
  }
}

module.exports = new CameraService();
