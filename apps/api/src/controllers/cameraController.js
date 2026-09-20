const prisma = require('../config/prisma');

async function list(req, res, next) {
  try {
    const cameras = await prisma.cameras.findMany({
      where: { studio_id: req.studioId },
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
    res.json(cameras);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, model, sftpgo_username, sftpgo_password } = req.body;

    if (!name || !sftpgo_username || !sftpgo_password) {
      return res.status(400).json({ error: 'name, sftpgo_username, and sftpgo_password are required' });
    }

    const existing = await prisma.cameras.findUnique({
      where: { sftpgo_username },
    });

    if (existing) {
      return res.status(409).json({ error: 'SFTPGo username is already in use' });
    }

    console.log(`[Camera Controller] Provisioning SFTPGo account for camera: ${sftpgo_username}`);

    const camera = await prisma.cameras.create({
      data: {
        studio_id: req.studioId,
        name,
        model,
        sftpgo_username,
        sftpgo_password_hash: 'masked_sftp_hash',
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

    res.status(201).json(camera);
  } catch (err) {
    next(err);
  }
}

async function toggleActive(req, res, next) {
  try {
    const cameraId = req.params.id;
    const { is_active } = req.body;

    const camera = await prisma.cameras.update({
      where: { id: cameraId },
      data: { is_active: !!is_active },
    });

    res.json(camera);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list,
  create,
  toggleActive,
};
