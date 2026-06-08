/**
 * React Router configuration with all application routes.
 */
import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Dashboard from '../pages/Dashboard';
import Connections from '../pages/Connections';
import MetadataRetrieval from '../pages/MetadataRetrieval';
import Comparison from '../pages/Comparison';
import DriftAnalysis from '../pages/DriftAnalysis';
import SyncCenter from '../pages/SyncCenter';
import Reports from '../pages/Reports';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'connections', element: <Connections /> },
      { path: 'metadata', element: <MetadataRetrieval /> },
      { path: 'comparison', element: <Comparison /> },
      { path: 'drift', element: <DriftAnalysis /> },
      { path: 'sync', element: <SyncCenter /> },
      { path: 'reports', element: <Reports /> },
    ],
  },
]);

export default router;
