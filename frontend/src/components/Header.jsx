/**
 * Header — Top bar with breadcrumbs, environment selector, and status.
 */
import { useLocation } from 'react-router-dom';
import { Bell, Search, Settings, CircleDot, Sun, Moon, ServerCog } from 'lucide-react';
import { useUIStore, useOrgStore } from '../store';
import { useEffect, useState } from 'react';
import { checkHealth } from '../services/api';

const routeLabels = {
  '/': 'Dashboard',
  '/connections': 'Org Connections',
  '/agent': 'Agent Orchestrator',
};

export default function Header() {
  const location = useLocation();
  const pageTitle = routeLabels[location.pathname] || 'Dashboard';
  const environments = useOrgStore((s) => s.environments);
  const fetchStatus = useOrgStore((s) => s.fetchStatus);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const [backendUp, setBackendUp] = useState(false);

  useEffect(() => {
    fetchStatus();
    // Backend health polling
    const ping = () => checkHealth().then(() => setBackendUp(true)).catch(() => setBackendUp(false));
    ping();
    const interval = setInterval(ping, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className="flex items-center justify-between px-6 shrink-0"
      style={{
        height: 'var(--header-height)',
        background: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border-primary)',
      }}
    >
      {/* Left — Breadcrumb */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {pageTitle}
          </h1>
          <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Salesforce Metadata Governance
              <span
              title={backendUp ? 'Backend connected' : 'Backend offline — start uvicorn on port 8000'}
              className="inline-block w-2 h-2 rounded-full"
              style={{
                background: backendUp ? 'var(--color-status-success)' : 'var(--color-status-error)',
              }}
            />
          </p>
        </div>
      </div>

      {/* Right — Status & Actions */}
      <div className="flex items-center gap-4">
        {/* Environment Status Pills */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-primary)' }}>
          {['DEV', 'UAT', 'PROD'].map((env) => {
            const org = environments.find((e) => e.environment === env);
            const connected = org?.connected;
            return (
              <div key={env} className="flex items-center gap-1.5">
                <CircleDot
                  size={10}
                  style={{ color: connected ? 'var(--color-status-success)' : 'var(--color-text-muted)' }}
                  fill={connected ? 'var(--color-status-success)' : 'transparent'}
                />
                <span className="text-[11px] font-semibold" style={{ color: connected ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}>
                  {env}
                </span>
              </div>
            );
          })}
        </div>

        {/* Theme Toggle */}
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer" 
          style={{ color: 'var(--color-text-tertiary)' }}
          title="Toggle Light/Dark Mode"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
