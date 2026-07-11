/**
 * Dashboard — Main overview and entry point for the Agent Workflow.
 */
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Bot, Activity, TrendingUp, Zap, FileBarChart
} from 'lucide-react';
import { useOrgStore } from '../store';
import { EnvironmentCard } from '../components/StatusBadge';

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
  useEffect(() => { fetchStatus(); }, []);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Page Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <Bot className="text-blue-400" />
            Deployment-Based Permission Agent
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Intelligently evaluate and deploy specific Salesforce component permissions
          </p>
        </div>
        <div className="flex gap-2">
          <QuickAction icon={Bot} label="Run Agent" onClick={() => navigate('/agent')} />
        </div>
      </motion.div>

      {/* Top Stats Cards */}
      <motion.div variants={item} className="grid grid-cols-4 gap-4">
        {[
          { label: 'Connected Orgs', value: environments.filter(e => e.connected).length },
          { label: 'Configured Envs', value: environments.length },
          { label: 'Total Metadata Cached', value: environments.reduce((sum, e) => sum + (e.metadata_count || 0), 0) },
          { label: 'Agent Status', value: 'Ready' }
        ].map((stat, i) => (
          <div key={i} className="card p-4 flex flex-col justify-center">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>{stat.label}</span>
            <span className="text-2xl font-bold mt-2" style={{ color: 'var(--color-text-primary)' }}>{stat.value}</span>
          </div>
        ))}
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
              No environments configured. Go to <span className="font-bold cursor-pointer transition-colors" style={{ color: 'var(--color-accent-blue)' }} onClick={() => navigate('/connections')}>Org Connections</span> to start.
            </div>
          )}
        </div>
      </motion.div>

      {/* Bottom Grid — Getting Started */}
      <motion.div variants={item} className="grid grid-cols-1 gap-4">
        <div className="card p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-accent-blue)' }}>
            Getting Started with the Agent
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            The new agent workflow replaces full-org syncs with targeted component deployments.
          </p>
          <ul className="text-sm space-y-2 list-disc list-inside" style={{ color: 'var(--color-text-tertiary)' }}>
            <li>Connect your Source and Target orgs.</li>
            <li>Launch the <strong style={{ color: 'var(--color-text-primary)' }}>Agent Orchestrator</strong>.</li>
            <li>Add the specific components (e.g. ApexClass) you want to deploy permissions for.</li>
            <li>Review the AI-generated impact plan and deploy your changes cleanly.</li>
          </ul>
          <button 
            onClick={() => navigate('/agent')}
            className="btn-primary mt-6"
          >
            Launch Agent
          </button>
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
