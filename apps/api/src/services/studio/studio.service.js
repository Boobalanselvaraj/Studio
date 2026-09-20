const studioRepo = require('../../repositories/studio.repository');

class StudioService {
  async getStudio(studioId) {
    return studioRepo.findById(studioId);
  }

  async getAllStudios() {
    return studioRepo.findAll();
  }

  async createStudio(data) {
    return studioRepo.create(data);
  }

  async getBranding(studioId) {
    return studioRepo.getBranding(studioId);
  }

  async updateBranding(studioId, data) {
    return studioRepo.updateBranding(studioId, data);
  }
}

module.exports = new StudioService();
