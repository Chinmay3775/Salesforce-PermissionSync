/**
 * API client service for communicating with the FastAPI backend.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ============ Org Connection ============
export const connectOrg = (data) => api.post('/connect-org', data);
export const getEnvironmentStatus = () => api.get('/environment-status');
export const disconnectOrg = (data) => api.post('/disconnect-org', data);

// ============ Metadata ============
export const fetchMetadata = (data) => api.post('/fetch-metadata', data);
export const getMetadataTree = (environment) => api.get(`/metadata-tree?environment=${environment}`);
export const getMetadataSnapshot = (environment, profile) => {
  let url = `/metadata-snapshot?environment=${environment}`;
  if (profile) url += `&profile=${profile}`;
  return api.get(url);
};

// ============ Comparison ============
export const compareEnvironments = (data) => api.post('/compare-environments', data);
export const getDriftReport = (sourceEnv, targetEnv) =>
  api.get(`/drift-report?source_env=${sourceEnv}&target_env=${targetEnv}`);
export const getComparisonSummary = () => api.get('/comparison-summary');

// ============ Sync ============
export const syncPermissions = (data) => api.post('/sync-permissions', data);
export const getSyncHistory = () => api.get('/sync-history');

// ============ Reports ============
export const generateReport = (data) => api.post('/generate-report', data);
export const getReports = () => api.get('/reports');
export const downloadReport = (reportId) =>
  api.get(`/reports/download/${reportId}`, { responseType: 'blob' });

// ============ Health ============
export const checkHealth = () => api.get('/health');
export const validateConnection = (data) => api.post('/validate-connection', data);

export default api;
