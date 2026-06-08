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

// ============ Metadata Store ============
export const useMetadataStore = create((set) => ({
  metadata: {},
  tree: null,
  fetchProgress: {},
  loading: false,

  fetchMetadata: async (environment) => {
    set((s) => ({ loading: true, fetchProgress: { ...s.fetchProgress, [environment]: 0 } }));
    try {
      set((s) => ({ fetchProgress: { ...s.fetchProgress, [environment]: 50 } }));
      const res = await api.fetchMetadata({ environment });
      set((s) => ({
        metadata: { ...s.metadata, [environment]: res.data },
        fetchProgress: { ...s.fetchProgress, [environment]: 100 },
        loading: false,
      }));
      return res.data;
    } catch (err) {
      set((s) => ({
        fetchProgress: { ...s.fetchProgress, [environment]: 0 },
        loading: false,
      }));
      return null;
    }
  },

  fetchTree: async (environment) => {
    try {
      const res = await api.getMetadataTree(environment);
      set({ tree: res.data });
    } catch { set({ tree: null }); }
  },
}));

// ============ Comparison Store ============
export const useComparisonStore = create((set) => ({
  results: null,
  summaries: [],
  loading: false,
  filters: { category: 'all', severity: 'all', status: 'all', search: '' },

  compare: async (sourceEnv, targetEnv, profileName) => {
    set({ loading: true });
    try {
      const res = await api.compareEnvironments({ source_env: sourceEnv, target_env: targetEnv, profile_name: profileName });
      set({ results: res.data, loading: false });
      return res.data;
    } catch (err) {
      set({ loading: false });
    }
  },

  fetchSummaries: async () => {
    try {
      const res = await api.getComparisonSummary();
      set({ summaries: res.data.comparisons });
    } catch { /* fallback handled in component */ }
  },

  setFilters: (filters) => set((s) => ({ filters: { ...s.filters, ...filters } })),
}));

// ============ Drift Store ============
export const useDriftStore = create((set) => ({
  report: null,
  loading: false,

  fetchDriftReport: async (sourceEnv, targetEnv) => {
    set({ loading: true });
    try {
      const res = await api.getDriftReport(sourceEnv, targetEnv);
      set({ report: res.data, loading: false });
      return res.data;
    } catch (err) {
      set({ loading: false });
    }
  },
}));

// ============ Sync Store ============
export const useSyncStore = create((set) => ({
  preview: null,
  result: null,
  history: [],
  loading: false,

  previewSync: async (sourceEnv, targetEnv, items, syncAll) => {
    set({ loading: true });
    try {
      const res = await api.syncPermissions({ source_env: sourceEnv, target_env: targetEnv, items, sync_all: syncAll, dry_run: true });
      set({ preview: res.data, loading: false });
      return res.data;
    } catch { set({ loading: false }); }
  },

  executeSync: async (sourceEnv, targetEnv, items, syncAll) => {
    set({ loading: true });
    try {
      const res = await api.syncPermissions({ source_env: sourceEnv, target_env: targetEnv, items, sync_all: syncAll, dry_run: false });
      set({ result: res.data, loading: false });
      return res.data;
    } catch { set({ loading: false }); }
  },

  fetchHistory: async () => {
    try {
      const res = await api.getSyncHistory();
      set({ history: res.data.history });
    } catch { /* fallback */ }
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
