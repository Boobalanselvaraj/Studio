const axios = require('axios');
const fs = require('fs');
const stream = require('stream');

const IMMICH_URL = process.env.IMMICH_URL || 'http://localhost:2283';
const IMMICH_API_KEY = process.env.IMMICH_API_KEY || '';

async function indexAssetInImmich({ assetId, originalPath, mimeType }) {
  if (!IMMICH_API_KEY) {
    console.info(`[ImmichService] IMMICH_API_KEY not configured. Asset '${assetId}' indexed in local fallback mode.`);
    return {
      success: false,
      immich_asset_id: null,
      mode: 'not_configured',
    };
  }

  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('assetData', fs.createReadStream(originalPath));
    form.append('deviceAssetId', assetId);
    form.append('deviceId', 'studio-api');

    const res = await axios.post(`${IMMICH_URL}/api/assets`, form, {
      headers: {
        'x-api-key': IMMICH_API_KEY,
        ...form.getHeaders(),
      },
      timeout: 10000,
    });

    return {
      success: true,
      immich_asset_id: res.data.id || `immich_${assetId}`,
      mode: 'immich_live',
    };
  } catch (err) {
    console.warn(`[ImmichService] Immich indexing failed for asset '${assetId}':`, err.message);
    return {
      success: false,
      immich_asset_id: null,
      mode: 'error',
    };
  }
}

function generatePlaceholderSvgThumbnail(label = 'Photograph') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <rect width="600" height="400" fill="#1e293b"/>
    <circle cx="300" cy="180" r="60" fill="#3b82f6" opacity="0.4"/>
    <polygon points="150,320 280,200 380,320" fill="#334155"/>
    <polygon points="280,320 400,160 500,320" fill="#475569"/>
    <text x="300" y="360" font-family="sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">${label}</text>
  </svg>`;
  return stream.Readable.from([svg]);
}

async function getImmichThumbnailStream(immichAssetId, label = 'Photograph') {
  if (!IMMICH_API_KEY || !immichAssetId || immichAssetId.startsWith('immich_mock_') || immichAssetId.startsWith('immich_fallback_')) {
    return { stream: generatePlaceholderSvgThumbnail(label), contentType: 'image/svg+xml' };
  }

  try {
    const res = await axios.get(`${IMMICH_URL}/api/assets/${immichAssetId}/thumbnail`, {
      headers: { 'x-api-key': IMMICH_API_KEY },
      responseType: 'stream',
      timeout: 5000,
    });
    return { stream: res.data, contentType: res.headers['content-type'] || 'image/jpeg' };
  } catch (err) {
    return { stream: generatePlaceholderSvgThumbnail(label), contentType: 'image/svg+xml' };
  }
}

module.exports = {
  indexAssetInImmich,
  getImmichThumbnailStream,
  generatePlaceholderSvgThumbnail,
};
