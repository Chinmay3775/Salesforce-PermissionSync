/**
 * MainLayout — Application shell with sidebar and header.
 */
import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useUIStore } from '../store';

export default function MainLayout() {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--color-bg-primary)' }}>
      <Sidebar />
      <div
        className="flex flex-col flex-1 min-w-0 transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)' }}
      >
        <Header />
        <main
          className="flex-1 overflow-y-auto p-6 scrollbar-thin"
          style={{ background: 'var(--color-bg-primary)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
