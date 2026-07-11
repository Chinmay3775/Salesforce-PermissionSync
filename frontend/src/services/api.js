/**
 * API client service for communicating with the FastAPI backend.
 */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000, // 60s — metadata fetches can be slow on large orgs
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for logging
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
export const validateConnection = (data) => api.post('/validate-connection', data);

// ============ Profiles ============
/** Fetch all Profile names from a connected org.
 *  @param {string} environment  "DEV" | "UAT" | "PROD"
 *  @returns {{ environment, profiles: string[], count: number }}
 */
export const getProfiles = (environment) =>
  api.get('/profiles', { params: { environment } });

// ============ Agent / Compare Workflow ============
/**
 * Run the comparison agent.
 * @param {{
 *   source_env: string,
 *   target_env: string,
 *   deployment_sheet: {type:string, name:string}[],
 *   profile_mapping?: {source_profile:string, target_profile:string}[]
 * }} data
 */
export const runAgent = (data) => api.post('/agent/run', data);
export const approveAgentActions = (data) => api.post('/agent/approve', data);

// ============ Reports ============
export const generateReport = (data) => api.post('/generate-report', data);
export const getReports = () => api.get('/reports');
export const downloadReport = (reportId) =>
  api.get(`/reports/download/${reportId}`, { responseType: 'blob' });

// ============ Health ============
export const checkHealth = () => api.get('/health');

export default api;
