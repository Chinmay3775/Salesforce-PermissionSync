/**
 * React Router configuration with all application routes.
 */
import { createBrowserRouter } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Dashboard from '../pages/Dashboard';
import Connections from '../pages/Connections';
import CompareWorkflow from '../pages/CompareWorkflow';

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true,      element: <Dashboard /> },
      { path: 'connections', element: <Connections /> },
      { path: 'agent',    element: <CompareWorkflow /> },
    ],
  },
]);

export default router;
