/**
 * Dashboard — Main overview with environment health, drift summaries, and quick actions.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Shield, AlertTriangle, GitCompareArrows, RefreshCcw,
  FileBarChart, TrendingUp, Activity, CheckCircle2,
  XCircle, Clock, ArrowRight, Zap, Database, Link2
} from 'lucide-react';
import { useOrgStore, useComparisonStore } from '../store';
import { EnvironmentCard, DriftSummaryCard } from '../components/StatusBadge';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const environments = useOrgStore((s) => s.environments);
  const fetchStatus = useOrgStore((s) => s.fetchStatus);
  const summary = useComparisonStore((s) => s.summaries?.[0]);
  useEffect(() => { fetchStatus(); }, []);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Page Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            Permission Governance
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Monitor, compare, and synchronize Salesforce permissions across environments
          </p>
        </div>
        <div className="flex gap-2">
          <QuickAction icon={GitCompareArrows} label="Compare" onClick={() => navigate('/comparison')} />
          <QuickAction icon={RefreshCcw} label="Sync" onClick={() => navigate('/sync')} />
          <QuickAction icon={FileBarChart} label="Report" onClick={() => navigate('/reports')} />
        </div>
      </motion.div>

      {/* Environment Health Cards */}
      <motion.div variants={item}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
          Environment Health
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {environments.length > 0 ? (
            environments.map((env) => (
              <EnvironmentCard
                key={env.environment}
                environment={env.environment}
                alias={env.alias}
                connected={env.connected}
                username={env.username}
                instanceUrl={env.instance_url}
                metadataCount={env.metadata_count}
                onClick={() => navigate('/connections')}
              />
            ))
          ) : (
            <div className="col-span-3 text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
              No environments configured. Go to <span className="font-bold cursor-pointer" style={{ color: 'var(--color-accent-blue)' }} onClick={() => navigate('/connections')}>Org Connections</span> to start.
            </div>
          )}
        </div>
      </motion.div>

      {/* Drift Summary Metrics */}
      <motion.div variants={item}>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
          Drift Overview
        </h3>
        <div className="grid grid-cols-4 gap-4">
          <DriftSummaryCard title="Critical Drifts" value={summary?.critical_drifts || 0} severity="Critical" icon={AlertTriangle} />
          <DriftSummaryCard title="High Severity" value={summary?.high_drifts || 0} severity="High" icon={Shield} />
          <DriftSummaryCard title="Medium Issues" value={summary?.medium_drifts || 0} severity="Medium" icon={Activity} />
          <DriftSummaryCard title="Low Priority" value={summary?.low_drifts || 0} severity="Low" icon={TrendingUp} />
        </div>
      </motion.div>

      {/* Bottom Grid — Activity */}
      <motion.div variants={item} className="grid grid-cols-1 gap-4">
        {/* Recent Activity */}
        <div className="glass-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
            Recent Activity
          </h3>
          <div className="space-y-3">
            <p className="text-sm py-4 text-center" style={{ color: 'var(--color-text-muted)' }}>No recent activity to display.</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer"
      style={{
        background: 'var(--color-bg-card)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border-primary)',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-accent)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-primary)'; }}
    >
      <Icon size={14} />
      {label}
    </motion.button>
  );
}
