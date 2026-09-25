import api from './client';

export const authApi = {
  login: async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  register: async (data) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },
  logout: async () => {
    const res = await api.post('/auth/logout');
    return res.data;
  },
  me: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

export const studioApi = {
  getProfile: async () => {
    const res = await api.get('/studio/profile');
    return res.data;
  },
  getDashboard: async () => {
    const res = await api.get('/studio/dashboard');
    return res.data;
  },
  getBranding: async () => {
    const res = await api.get('/studio/branding');
    return res.data;
  },
  updateBranding: async (data) => {
    const res = await api.put('/studio/branding', data);
    return res.data;
  },
};

export const eventsApi = {
  list: async (params = {}) => {
    const res = await api.get('/studio/events', { params });
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/studio/events', data);
    return res.data;
  },
  getById: async (id) => {
    const res = await api.get(`/studio/events/${id}`);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.patch(`/studio/events/${id}`, data);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/studio/events/${id}`);
    return res.data;
  },
  updateStatus: async (id, payload) => {
    const res = await api.post(`/studio/events/${id}/status`, payload);
    return res.data;
  },
  getHistory: async (id) => {
    const res = await api.get(`/studio/events/${id}/history`);
    return res.data;
  },
  getCalendar: async (params = {}) => {
    const res = await api.get('/studio/events/calendar', { params });
    return res.data;
  },
  getTasks: async (eventId) => {
    const res = await api.get(`/studio/events/${eventId}/tasks`);
    return res.data;
  },
  createTask: async (eventId, data) => {
    const res = await api.post(`/studio/events/${eventId}/tasks`, data);
    return res.data;
  },
  updateTask: async (taskId, data) => {
    const res = await api.patch(`/studio/events/tasks/${taskId}`, data);
    return res.data;
  },
  deleteTask: async (taskId) => {
    const res = await api.delete(`/studio/events/tasks/${taskId}`);
    return res.data;
  },
};

export const foldersApi = {
  updateAsset: async(id,data)=>(await api.patch('/studio/folders/assets/'+id,data)).data,
  deleteAsset: async(id)=>(await api.delete('/studio/folders/assets/'+id)).data,
  bulkDeleteAssets: async(assetIds)=>(await api.post('/studio/folders/assets/bulk-delete', { asset_ids: assetIds })).data,
  deleteProviderFolder: async(providerId, folderPath)=>(await api.post('/studio/folders/provider-folder/delete', { provider_id: providerId, folder_path: folderPath })).data,
  addFolderAssets: async(id,asset_ids)=>(await api.post('/studio/folders/'+id+'/assets',{asset_ids})).data,
  getTree: async () => {
    const res = await api.get('/studio/folders/tree');
    return res.data;
  },
  getServerExplorer: async () => {
    const res = await api.get('/studio/folders/server-explorer');
    return res.data;
  },
  batchAssignAssets: async (data) => {
    const res = await api.post('/studio/folders/batch-assign', data);
    return res.data;
  },
  syncStorage: async () => {
    const res = await api.post('/studio/folders/sync-storage');
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/studio/folders', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.patch(`/studio/folders/${id}`, data);
    return res.data;
  },
  move: async (id, targetParentId) => {
    const res = await api.post(`/studio/folders/${id}/move`, { target_parent_id: targetParentId });
    return res.data;
  },
  bulkMove: async (itemIds, targetFolderId) => {
    const res = await api.post('/studio/folders/bulk-move', {
      item_ids: itemIds,
      target_folder_id: targetFolderId,
    });
    return res.data;
  },
  delete: async (id, deleteFiles = false) => {
    const res = await api.delete(`/studio/folders/${id}${deleteFiles ? '?delete_files=true' : ''}`);
    return res.data;
  },

  publishGallery: async (id, data = {}) => {
    const res = await api.post(`/studio/folders/${id}/publish-gallery`, data);
    return res.data;
  },
};

export const camerasApi = {
  repairGateway: async(id,password)=>(await api.post(`/studio/cameras/${id}/repair-gateway`,{password})).data,
  list: async () => {
    const res = await api.get('/studio/cameras');
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/studio/cameras', data);
    return res.data;
  },
  toggleStatus: async (id, isActive) => {
    const res = await api.patch(`/studio/cameras/${id}/status`, { is_active: isActive });
    return res.data;
  },
  retire: async (id) => {
    const res = await api.post(`/studio/cameras/${id}/retire`);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/studio/cameras/${id}`);
    return res.data;
  },
  assignAlbum: async (id, albumId) => {
    const res = await api.patch(`/studio/cameras/${id}/album`, { album_id: albumId });
    return res.data;
  },
  getAssets: async (id) => {
    const res = await api.get(`/studio/cameras/${id}/assets`);
    return res.data;
  },
  uploadPhoto: async (id, file) => {
    const res = await api.post(`/studio/cameras/${id}/upload`, file, {
      headers: {
        'Content-Type': file.type || 'image/jpeg',
        'x-filename': file.name,
        'x-file-size': file.size ? file.size.toString() : '0',
      },
    });
    return res.data;
  },
};

export const albumsApi = {
  list: async () => {
    const res = await api.get('/studio/albums');
    return res.data;
  },
  getById: async (id) => {
    const res = await api.get(`/studio/albums/${id}`);
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/studio/albums', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.patch(`/studio/albums/${id}`, data);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/studio/albums/${id}`);
    return res.data;
  },
  publish: async (id) => {
    const res = await api.patch(`/studio/albums/${id}`, { is_published: true });
    return res.data;
  },
  unpublish: async (id) => {
    const res = await api.patch(`/studio/albums/${id}`, { is_published: false });
    return res.data;
  },
  addAssets: async (id, assetIds) => {
    const res = await api.post(`/studio/albums/${id}/assets`, { asset_ids: assetIds });
    return res.data;
  },
  removeAsset: async (id, assetId) => {
    const res = await api.delete(`/studio/albums/${id}/assets/${assetId}`);
    return res.data;
  },
  downloadZip: async (id, favoritesOnly = false) => {
    const res = await api.get(`/studio/albums/${id}/download${favoritesOnly ? '?favorites=true' : ''}`, {
      responseType: 'blob',
    });
    return res.data;
  },
  getDownloadUrl: (id, favoritesOnly = false) => {
    const token = localStorage.getItem('token');
    const studioId = localStorage.getItem('currentStudioId');
    const params = new URLSearchParams();
    if (favoritesOnly) params.append('favorites', 'true');
    if (token) params.append('token', token);
    if (studioId) params.append('studioId', studioId);
    const qs = params.toString();
    return `/api/studio/albums/${id}/download${qs ? `?${qs}` : ''}`;
  },
};

export const customersApi = {
  list: async () => {
    const res = await api.get('/studio/customers');
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/studio/customers', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.patch(`/studio/customers/${id}`, data);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/studio/customers/${id}`);
    return res.data;
  },
  shareAlbum: async (data) => {
    const res = await api.post('/studio/customers/albums/share', data);
    return res.data;
  },
  unshareAlbum: async (data) => {
    const res = await api.post('/studio/customers/albums/unshare', data);
    return res.data;
  },
};

export const storageApi = {
  getProviders: async () => {
    const res = await api.get('/studio/storage/providers');
    return res.data;
  },
  createProvider: async (data) => {
    const res = await api.post('/studio/storage/providers', data);
    return res.data;
  },
  updateProvider: async (id, data) => {
    const res = await api.put(`/studio/storage/providers/${id}`, data);
    return res.data;
  },
  removeProvider: async (id) => {
    const res = await api.delete(`/studio/storage/providers/${id}`);
    return res.data;
  },
  testConnection: async (id) => {
    const res = await api.post(`/studio/storage/providers/${id}/test`);
    return res.data;
  },
  getProviderStats: async (id) => {
    const res = await api.get(`/studio/storage/providers/${id}/stats`);
    return res.data;
  },
};

export const sharesApi = {
  createShare: async (data) => {
    const res = await api.post('/studio/shares/shares', data);
    return res.data;
  },
  listShares: async (params = {}) => {
    const res = await api.get('/studio/shares/shares', { params });
    return res.data;
  },
  revokeShare: async (id) => {
    const res = await api.delete(`/studio/shares/shares/${id}`);
    return res.data;
  },
};

export const uploadProfilesApi = {
  createProfile: async (data) => {
    const res = await api.post('/studio/upload-profiles/profiles', data);
    return res.data;
  },
  listProfiles: async () => {
    const res = await api.get('/studio/upload-profiles/profiles');
    return res.data;
  },
  revokeProfile: async (id) => {
    const res = await api.delete(`/studio/upload-profiles/profiles/${id}`);
    return res.data;
  },
};

export const publicGalleryApi = {
  getSharedGallery: async (token) => {
    const res = await api.get(`/public/shares/${token}`);
    return res.data;
  },
};

export const billingApi = {
  getUsage: async () => {
    const res = await api.get('/studio/billing/usage');
    return res.data;
  },
  getProfile: async () => {
    const res = await api.get('/studio/billing/profile');
    return res.data;
  },
  getInvoices: async () => {
    const res = await api.get('/studio/billing/invoices');
    return res.data;
  },
  getPlans: async () => {
    const res = await api.get('/studio/billing/plans');
    return res.data;
  },
  requestUpgrade: async (data) => {
    const res = await api.post('/studio/billing/request-upgrade', data);
    return res.data;
  },
  getRequests: async () => {
    const res = await api.get('/studio/billing/requests');
    return res.data;
  },
  getSubscriptions: async () => {
    const res = await api.get('/studio/billing/subscriptions');
    return res.data;
  },
};

export const adminApi = {
  listStudios: async () => {
    const res = await api.get('/admin/studios');
    return res.data;
  },
  createStudio: async (data) => {
    const res = await api.post('/admin/studios', data);
    return res.data;
  },
  updateStudio: async (id, data) => {
    const res = await api.patch(`/admin/studios/${id}`, data);
    return res.data;
  },
  updateStudioBilling: async (id, data) => {
    const res = await api.patch(`/admin/studios/${id}/billing-profile`, data);
    return res.data;
  },
  getStudioAllocations: async (id) => {
    const res = await api.get(`/admin/studios/${id}/allocations`);
    return res.data;
  },
  listAllocationRequests: async () => {
    const res = await api.get('/admin/allocation-requests');
    return res.data;
  },
  createAllocationRequest: async (data) => {
    const res = await api.post('/admin/allocation-requests', data);
    return res.data;
  },
  updateAllocationRequest: async (id, data) => {
    const res = await api.patch(`/admin/allocation-requests/${id}`, data);
    return res.data;
  },
  deleteAllocationRequest: async (id) => {
    const res = await api.delete(`/admin/allocation-requests/${id}`);
    return res.data;
  },
  resolveAllocationRequest: async (id, data) => {
    const res = await api.post(`/admin/allocation-requests/${id}/resolve`, data);
    return res.data;
  },
  listAllInvoices: async () => {
    const res = await api.get('/admin/invoices');
    return res.data;
  },
  listStudioInvoices: async (studioId) => {
    const res = await api.get(`/admin/studios/${studioId}/invoices`);
    return res.data;
  },
  generateStudioInvoice: async (studioId, data) => {
    const res = await api.post(`/admin/studios/${studioId}/invoices`, data);
    return res.data;
  },
  updateStudioInvoice: async (studioId, invoiceId, data) => {
    const res = await api.patch(`/admin/studios/${studioId}/invoices/${invoiceId}`, data);
    return res.data;
  },
  deleteStudioInvoice: async (studioId, invoiceId) => {
    const res = await api.delete(`/admin/studios/${studioId}/invoices/${invoiceId}`);
    return res.data;
  },
  getBillingPlans: async () => {
    const res = await api.get('/admin/billing-plans');
    return res.data;
  },
  createBillingPlan: async (data) => {
    const res = await api.post('/admin/billing-plans', data);
    return res.data;
  },
  recordManualPayment: async (studioId, invoiceId, data = {}) => {
    const res = await api.post(`/admin/studios/${studioId}/invoices/${invoiceId}/manual-payment`, data);
    return res.data;
  },
  listStudioStorageConnections: async (studioId) => {
    const res = await api.get(`/admin/studios/${studioId}/storage-connections`);
    return res.data;
  },
  provisionPlatformStorage: async (studioId, data) => {
    const res = await api.post(`/admin/studios/${studioId}/storage-connections`, data);
    return res.data;
  },
  listStorageServers: async () => {
    const res = await api.get('/admin/storage-servers');
    return res.data;
  },
  createStorageServer: async (data) => {
    const res = await api.post('/admin/storage-servers', data);
    return res.data;
  },
  updateStorageServer: async (id, data) => {
    const res = await api.put(`/admin/storage-servers/${id}`, data);
    return res.data;
  },
  deleteStorageServer: async (id) => {
    const res = await api.delete(`/admin/storage-servers/${id}`);
    return res.data;
  },
  testStorageServer: async (id) => {
    const res = await api.post(`/admin/storage-servers/${id}/test`);
    return res.data;
  },
  getStorageServerStats: async (id) => {
    const res = await api.get(`/admin/storage-servers/${id}/stats`);
    return res.data;
  },
  // Subscriptions & Recurring multi-cycle schedules
  listSubscriptions: async (studioId) => {
    const res = await api.get(`/admin/studios/${studioId}/subscriptions`);
    return res.data;
  },
  createSubscription: async (studioId, data) => {
    const res = await api.post(`/admin/studios/${studioId}/subscriptions`, data);
    return res.data;
  },
  updateSubscription: async (studioId, subId, data) => {
    const res = await api.patch(`/admin/studios/${studioId}/subscriptions/${subId}`, data);
    return res.data;
  },
  cancelSubscription: async (studioId, subId) => {
    const res = await api.delete(`/admin/studios/${studioId}/subscriptions/${subId}`);
    return res.data;
  },
  triggerSubscriptionInvoice: async (studioId, subId) => {
    const res = await api.post(`/admin/studios/${studioId}/subscriptions/${subId}/invoice`);
    return res.data;
  },
};

export const customerPortalApi = {
  getMyGalleries: async () => {
    const res = await api.get('/customer/albums');
    return res.data;
  },
  getAlbumById: async (id) => {
    const res = await api.get(`/customer/albums/${id}`);
    return res.data;
  },
  toggleFavorite: async (albumId, assetId, isFavorite) => {
    const res = await api.post(`/customer/albums/${albumId}/assets/${assetId}/favorite`, {
      is_favorite: isFavorite,
    });
    return res.data;
  },
  downloadZip: async (id, favoritesOnly = false) => {
    const res = await api.get(`/customer/albums/${id}/download${favoritesOnly ? '?favorites=true' : ''}`, {
      responseType: 'blob',
    });
    return res.data;
  },
  getDownloadUrl: (id, favoritesOnly = false) => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (favoritesOnly) params.append('favorites', 'true');
    if (token) params.append('token', token);
    const qs = params.toString();
    return `/api/customer/albums/${id}/download${qs ? `?${qs}` : ''}`;
  },
};

export function triggerFileDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
