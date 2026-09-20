import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  currentStudio: null,
  studios: [],
  token: localStorage.getItem('token') || null,

  setUser: (user) => set({ user }),
  setCurrentStudio: (studio) => {
    if (studio?.id) {
      localStorage.setItem('currentStudioId', studio.id);
    }
    set({ currentStudio: studio });
  },
  setAuth: ({ user, studios, token }) => {
    if (token) localStorage.setItem('token', token);
    set({ user, studios, token, currentStudio: studios?.[0] || null });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('currentStudioId');
    set({ user: null, currentStudio: null, studios: [], token: null });
  }
}));
