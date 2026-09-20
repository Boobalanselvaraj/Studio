const studioRepo = require('../../repositories/studio.repository');

class BrandingService {
  async getStudioBranding(studioId) {
    let branding = await studioRepo.getBranding(studioId);
    if (!branding) {
      branding = {
        studio_id: studioId,
        brand_name: null,
        logo_url: null,
        primary_color: '#3B82F6',
        secondary_color: '#1E293B',
        accent_color: '#10B981',
        custom_css: null
      };
    }
    return branding;
  }

  async updateStudioBranding(studioId, data) {
    return studioRepo.updateBranding(studioId, data);
  }
}

module.exports = new BrandingService();
