/**
 * Zustand stores for global state management.
 */
import { create } from 'zustand';
import * as api from '../services/api';

// ============ Org Connection Store ============
export const useOrgStore = create((set, get) => ({
  environments: [],
  loading: false,
  error: null,

  fetchStatus: async () => {
    set({ loading: true, error: null });
    try {
      const res = await api.getEnvironmentStatus();
      set({ environments: res.data.environments, loading: false });
    } catch (err) {
      set({
        environments: [],
        loading: false,
        error: null,
      });
    }
  },

  connectOrg: async (data) => {
    set({ loading: true });
    try {
      const res = await api.connectOrg(data);
      await get().fetchStatus();
      return res.data;
    } catch (err) {
      set({ loading: false, error: err.message });
      throw err;
    }
  },

  disconnectOrg: async (environment) => {
    set({ loading: true });
    try {
      await api.disconnectOrg({ environment });
      await get().fetchStatus();
    } catch (err) {
      set({ loading: false, error: err.message });
    }
  },
}));

// ============ Report Store ============
export const useReportStore = create((set) => ({
  reports: [],
  loading: false,

  generateReport: async (data) => {
    set({ loading: true });
    try {
      const res = await api.generateReport(data);
      set({ loading: false });
      return res.data;
    } catch { set({ loading: false }); }
  },

  fetchReports: async () => {
    try {
      const res = await api.getReports();
      set({ reports: res.data.reports });
    } catch { /* fallback */ }
  },
}));

// ============ UI Store ============
export const useUIStore = create((set) => {
  // Initialize theme from localStorage or system preference
  const getInitialTheme = () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedPrefs = window.localStorage.getItem('color-theme');
      if (typeof storedPrefs === 'string') {
        return storedPrefs;
      }
      const userMedia = window.matchMedia('(prefers-color-scheme: dark)');
      if (userMedia.matches) {
        return 'dark';
      }
    }
    return 'light'; // Default to light theme per new requirement
  };

  return {
    sidebarCollapsed: false,
    activeEnvironment: 'DEV',
    notifications: [],
    theme: getInitialTheme(),
    
    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    setActiveEnvironment: (env) => set({ activeEnvironment: env }),
    addNotification: (msg) => set((s) => ({
      notifications: [...s.notifications, { id: Date.now(), message: msg, timestamp: new Date() }],
    })),
    clearNotifications: () => set({ notifications: [] }),
    setTheme: (theme) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('color-theme', theme);
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      set({ theme });
    },
  };
});
