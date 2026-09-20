const prisma = require('../../config/prisma');
const sftpgoService = require('../sftpgo/sftpgo.service');

class CameraService {
  async getCameras(studio_id) {
    return prisma.cameras.findMany({
      where: { studio_id },
      select: {
        id: true,
        studio_id: true,
        name: true,
        model: true,
        sftpgo_username: true,
        is_active: true,
        last_sync_at: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async createCamera(studio_id, { name, model, sftpgo_username, sftpgo_password }) {
    // 1. Provision SFTPGo User
    await sftpgoService.createUser({
      username: sftpgo_username,
      password: sftpgo_password,
      home_dir: `/srv/sftpgo/data/${studio_id}/cameras/${sftpgo_username}`,
    });

    // 2. Save in database using Prisma
    return prisma.cameras.create({
      data: {
        studio_id,
        name,
        model,
        sftpgo_username,
        sftpgo_password_hash: 'masked_hash',
      },
      select: {
        id: true,
        studio_id: true,
        name: true,
        model: true,
        sftpgo_username: true,
        is_active: true,
        created_at: true,
      },
    });
  }
}

module.exports = new CameraService();
