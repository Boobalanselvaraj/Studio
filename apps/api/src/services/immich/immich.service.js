const env = require('../../config/env');

class ImmichService {
  async indexAsset({ filePath, studioId }) {
    console.log(`[Immich Service] Indexing asset for studio ${studioId}: ${filePath}`);
    // Stub for Immich upload / asset scan API call
    return {
      immichAssetId: `immich_${Date.now()}`,
      indexed: true
    };
  }

  async getThumbnail(immichAssetId, size = 'preview') {
    // Stub for internal Immich thumbnail proxy
    return {
      immichAssetId,
      size,
      mimeType: 'image/jpeg'
    };
  }
}

module.exports = new ImmichService();
