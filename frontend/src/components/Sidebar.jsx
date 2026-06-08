/**
 * Sidebar — Collapsible navigation sidebar with animated transitions.
 */
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Link2, Database, GitCompareArrows,
  AlertTriangle, RefreshCcw, FileBarChart, ChevronLeft,
  ChevronRight, Shield, Zap
} from 'lucide-react';
import { useUIStore } from '../store';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/connections', label: 'Connections', icon: Link2 },
  { path: '/metadata', label: 'Metadata', icon: Database },
  { path: '/comparison', label: 'Comparison', icon: GitCompareArrows },
  { path: '/drift', label: 'Drift Analysis', icon: AlertTriangle },
  { path: '/sync', label: 'Sync Center', icon: RefreshCcw },
  { path: '/reports', label: 'Reports', icon: FileBarChart },
];

export default function Sidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggle = useUIStore((s) => s.toggleSidebar);

  return (
    <motion.aside
      className="fixed left-0 top-0 h-screen flex flex-col z-50"
      style={{
        width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
        background: 'var(--gradient-sidebar)',
        borderRight: '1px solid var(--color-border-primary)',
      }}
      animate={{ width: collapsed ? 68 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
    >
      {/* Logo Section */}
      <div className="flex items-center gap-3 px-4 h-[60px] border-b" style={{ borderColor: 'var(--color-border-primary)' }}>
        <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: 'var(--gradient-primary)' }}>
          <Shield size={20} className="text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col"
            >
              <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
                PermissionSync
              </span>
              <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: 'var(--color-accent-cyan)' }}>
                Salesforce DevOps
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto scrollbar-thin">
        <div className="space-y-1">
          {navItems.map((item) => (
            <SidebarLink key={item.path} item={item} collapsed={collapsed} />
          ))}
        </div>
      </nav>

      {/* Environment Indicator */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mx-3 mb-3 p-3 rounded-lg"
            style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-primary)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap size={12} style={{ color: 'var(--color-status-success)' }} />
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                Connected Orgs
              </span>
            </div>
            <div className="flex gap-2">
              {['DEV', 'UAT', 'PROD'].map((env) => (
                <span
                  key={env}
                  className="px-2 py-0.5 rounded text-[10px] font-bold"
                  style={{
                    background: env === 'DEV' ? 'var(--color-env-dev)20' : env === 'UAT' ? 'var(--color-env-uat)20' : 'var(--color-env-prod)20',
                    color: env === 'DEV' ? 'var(--color-env-dev)' : env === 'UAT' ? 'var(--color-env-uat)' : 'var(--color-env-prod)',
                  }}
                >
                  {env}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapse Toggle */}
      <button
        onClick={toggle}
        className="flex items-center justify-center h-10 border-t transition-colors hover:bg-white/5 cursor-pointer"
        style={{ borderColor: 'var(--color-border-primary)' }}
      >
        {collapsed ? (
          <ChevronRight size={16} style={{ color: 'var(--color-text-tertiary)' }} />
        ) : (
          <ChevronLeft size={16} style={{ color: 'var(--color-text-tertiary)' }} />
        )}
      </button>
    </motion.aside>
  );
}

function SidebarLink({ item, collapsed }) {
  const location = useLocation();
  const isActive = location.pathname === item.path;
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative no-underline"
      style={{
        background: isActive ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
        color: isActive ? 'var(--color-accent-blue)' : 'var(--color-text-secondary)',
        borderLeft: isActive ? '2px solid var(--color-accent-blue)' : '2px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            transition={{ duration: 0.15 }}
            className="text-[13px] font-medium whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 rounded text-xs font-medium opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50"
          style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-primary)' }}
        >
          {item.label}
        </div>
      )}
    </NavLink>
  );
}
