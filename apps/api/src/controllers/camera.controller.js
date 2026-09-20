const cameraService = require('../services/camera/camera.service');

class CameraController {
  async list(req, res, next) {
    try {
      const cameras = await cameraService.getCameras(req.studioId);
      res.json(cameras);
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const camera = await cameraService.createCamera(req.studioId, req.body);
      res.status(201).json(camera);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CameraController();
