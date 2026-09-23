import { create } from 'zustand';
import { authApi } from '../api/services';

export const useAuthStore = create((set, get) => ({
  user: null,
  currentStudio: null,
  studios: [],
  token: localStorage.getItem('token') || null,
  isInitialized: false,
  isLoading: false,

  setUser: (user) => set({ user }),

  setCurrentStudio: (studio) => {
    if (studio?.id) {
      localStorage.setItem('currentStudioId', studio.id);
    }
    set({ currentStudio: studio });
  },

  setAuth: ({ user, studios, token }) => {
    if (token) localStorage.setItem('token', token);
    const savedStudioId = localStorage.getItem('currentStudioId');
    const matchedStudio = studios?.find((s) => s.id === savedStudioId) || studios?.[0] || null;

    if (matchedStudio?.id) {
      localStorage.setItem('currentStudioId', matchedStudio.id);
    } else {
      localStorage.removeItem('currentStudioId');
    }

    set({
      user,
      studios: studios || [],
      token,
      currentStudio: matchedStudio,
      isInitialized: true,
    });
  },

  initAuth: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ isInitialized: true, user: null, studios: [], currentStudio: null });
      return;
    }

    try {
      set({ isLoading: true });
      const data = await authApi.me();
      const savedStudioId = localStorage.getItem('currentStudioId');
      const matchedStudio = data.studios?.find((s) => s.id === savedStudioId) || data.studios?.[0] || null;

      if (matchedStudio?.id) {
        localStorage.setItem('currentStudioId', matchedStudio.id);
      }

      set({
        user: data.user,
        studios: data.studios || [],
        currentStudio: matchedStudio,
        isInitialized: true,
        isLoading: false,
      });
    } catch (err) {
      localStorage.removeItem('token');
      localStorage.removeItem('currentStudioId');
      set({
        token: null,
        user: null,
        studios: [],
        currentStudio: null,
        isInitialized: true,
        isLoading: false,
      });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // Ignore network errors on logout
    }
    localStorage.removeItem('token');
    localStorage.removeItem('currentStudioId');
    set({ user: null, currentStudio: null, studios: [], token: null });
  },
}));
