/**
 * StatusBadge — Color-coded severity/status badge component.
 */
import { motion } from 'framer-motion';

const severityColors = {
  Critical: { bg: 'var(--color-severity-critical)', text: '#fff' },
  High: { bg: 'var(--color-severity-high)', text: '#fff' },
  Medium: { bg: 'var(--color-severity-medium)', text: '#000' },
  Low: { bg: 'var(--color-severity-low)', text: '#fff' },
  Match: { bg: 'var(--color-status-success)', text: '#fff' },
  Mismatch: { bg: 'var(--color-diff-changed)', text: '#000' },
  'Missing in Source': { bg: 'var(--color-diff-removed)', text: '#fff' },
  'Missing in Target': { bg: 'var(--color-diff-removed)', text: '#fff' },
  Added: { bg: 'var(--color-diff-added)', text: '#fff' },
  Removed: { bg: 'var(--color-diff-removed)', text: '#fff' },
  Changed: { bg: 'var(--color-diff-changed)', text: '#000' },
  Success: { bg: 'var(--color-status-success)', text: '#fff' },
  Error: { bg: 'var(--color-status-error)', text: '#fff' },
  Warning: { bg: 'var(--color-status-warning)', text: '#000' },
  Connected: { bg: 'var(--color-status-success)', text: '#fff' },
  Disconnected: { bg: 'var(--color-text-muted)', text: '#fff' },
};

export default function StatusBadge({ label, size = 'sm', pulse = false }) {
  const colors = severityColors[label] || { bg: 'var(--color-text-muted)', text: '#fff' };

  const sizeClasses = {
    xs: 'text-[9px] px-1.5 py-0',
    sm: 'text-[10px] px-2 py-0.5',
    md: 'text-[11px] px-2.5 py-1',
    lg: 'text-xs px-3 py-1',
  };

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1 font-bold rounded-full uppercase tracking-wider whitespace-nowrap ${sizeClasses[size]}`}
      style={{ background: `color-mix(in srgb, ${colors.bg} 20%, transparent)`, color: colors.bg }}
    >
      {pulse && (
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: colors.bg }} />
      )}
      {label}
    </motion.span>
  );
}


/**
 * EnvironmentCard — Org connection status card.
 */
export function EnvironmentCard({ environment, alias, connected, orgId, username, instanceUrl, metadataCount, onClick }) {
  const envColors = {
    DEV: 'var(--color-env-dev)',
    UAT: 'var(--color-env-uat)',
    PROD: 'var(--color-env-prod)',
  };

  const color = envColors[environment] || 'var(--color-accent-blue)';

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 0 20px ${color}15` }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="card p-5 cursor-pointer"
      style={{ borderTop: `2px solid ${color}` }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${color}20`, color }}>
            {environment}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>{alias}</span>
        </div>
        <StatusBadge label={connected ? 'Connected' : 'Disconnected'} size="xs" pulse={connected} />
      </div>

      {connected ? (
        <>
          <p className="text-[11px] mb-1 truncate" style={{ color: 'var(--color-text-secondary)' }}>
            {username}
          </p>
          <p className="text-[10px] mb-3 truncate" style={{ color: 'var(--color-text-muted)' }}>
            {instanceUrl}
          </p>
          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--color-border-primary)' }}>
            <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>Metadata items</span>
            <span className="text-sm font-bold" style={{ color }}>{metadataCount || 0}</span>
          </div>
        </>
      ) : (
        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
          Click to connect this environment
        </p>
      )}
    </motion.div>
  );
}


/**
 * DriftSummaryCard — Metric card with severity indicator.
 */
export function DriftSummaryCard({ title, value, severity, icon: Icon, trend }) {
  const severityBg = {
    Critical: 'var(--color-severity-critical)',
    High: 'var(--color-severity-high)',
    Medium: 'var(--color-severity-medium)',
    Low: 'var(--color-severity-low)',
    info: 'var(--color-accent-blue)',
    success: 'var(--color-status-success)',
  };
  const color = severityBg[severity] || 'var(--color-accent-blue)';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="card p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
          {title}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
            <Icon size={16} style={{ color }} />
          </div>
        )}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold tracking-tight" style={{ color }}>{value}</span>
        {trend && (
          <span className="text-[10px] font-medium mb-1" style={{ color: trend > 0 ? 'var(--color-status-error)' : 'var(--color-status-success)' }}>
            {trend > 0 ? `+${trend}` : trend}%
          </span>
        )}
      </div>
    </motion.div>
  );
}


/**
 * ProgressBar — Animated progress indicator.
 */
export function ProgressBar({ value = 0, color = 'var(--color-accent-blue)', height = 4 }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height, background: 'var(--color-bg-input)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
}
