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
  getTree: async () => {
    const res = await api.get('/studio/folders/tree');
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
  delete: async (id) => {
    const res = await api.delete(`/studio/folders/${id}`);
    return res.data;
  },
};

export const camerasApi = {
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
  shareAlbum: async (data) => {
    const res = await api.post('/studio/customers/albums/share', data);
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
  testConnection: async (id) => {
    const res = await api.post(`/studio/storage/providers/${id}/test`);
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
  updateStudioBilling: async (id, data) => {
    const res = await api.patch(`/admin/studios/${id}/billing-profile`, data);
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
};

export const customerPortalApi = {
  getMyGalleries: async () => {
    const res = await api.get('/customer/albums');
    return res.data;
  },
};
