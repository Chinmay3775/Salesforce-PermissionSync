/**
 * Connections — Org connection management screen (OAuth 2.0 Client Credentials).
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Link2, Unlink, CheckCircle2, XCircle, Server,
  Lock, RefreshCcw, ExternalLink, Key, Shield, Globe
} from 'lucide-react';
import { useOrgStore } from '../store';
import StatusBadge from '../components/StatusBadge';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const envConfig = {
  DEV: { color: 'var(--color-env-dev)', label: 'Development', icon: '🔧' },
  UAT: { color: 'var(--color-env-uat)', label: 'User Acceptance Testing', icon: '🧪' },
  PROD: { color: 'var(--color-env-prod)', label: 'Production', icon: '🚀' },
};

export default function Connections() {
  const environments = useOrgStore((s) => s.environments);
  const fetchStatus = useOrgStore((s) => s.fetchStatus);
  const connectOrg = useOrgStore((s) => s.connectOrg);
  const disconnectOrg = useOrgStore((s) => s.disconnectOrg);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const orgs = environments.length ? environments : [
    { environment: 'DEV', connected: false },
    { environment: 'UAT', connected: false },
    { environment: 'PROD', connected: false }
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
          Org Connections
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Connect Salesforce environments using OAuth 2.0 Client Credentials
        </p>
      </motion.div>

      {/* OAuth Info Banner */}
      <motion.div variants={item} className="card p-4 flex items-center gap-3"
        style={{ borderLeft: '3px solid var(--color-accent-blue)' }}>
        <Shield size={18} style={{ color: 'var(--color-accent-blue)', flexShrink: 0 }} />
        <div>
          <p className="text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            OAuth 2.0 Client Credentials
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-tertiary)' }}>
            Provide your Connected App's Client ID, Client Secret, and Org URL to connect.
            No username or password required. Ensure "Client Credentials Flow" is enabled in your Connected App settings.
          </p>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-3 gap-6">
        {orgs.map((org) => (
          <OrgConnectionCard 
            key={org.environment} 
            org={org} 
            config={envConfig[org.environment]} 
            onConnect={connectOrg}
            onDisconnect={disconnectOrg}
          />
        ))}
      </motion.div>

      {/* Connection Details Table */}
      <motion.div variants={item} className="card p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
          Connection Details
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                {['Environment', 'Org Name', 'Org ID', 'Instance URL', 'Auth', 'Status', 'Metadata'].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orgs.map((org) => (
                <tr key={org.environment} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                  <td className="py-3 px-4">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{
                      background: `${envConfig[org.environment]?.color}20`,
                      color: envConfig[org.environment]?.color,
                    }}>
                      {org.environment}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>{org.org_name || '—'}</td>
                  <td className="py-3 px-4 text-xs font-mono" style={{ color: 'var(--color-text-secondary)' }}>{org.org_id || '—'}</td>
                  <td className="py-3 px-4 text-xs truncate max-w-[200px]" style={{ color: 'var(--color-text-tertiary)' }}>{org.instance_url || '—'}</td>
                  <td className="py-3 px-4">
                    {org.connected && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{
                        background: 'var(--color-accent-blue)15',
                        color: 'var(--color-accent-blue)',
                      }}>
                        OAuth 2.0
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4"><StatusBadge label={org.connected ? 'Connected' : 'Disconnected'} size="xs" pulse={org.connected} /></td>
                  <td className="py-3 px-4 text-xs font-semibold" style={{ color: 'var(--color-text-primary)' }}>{org.metadata_count || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

function OrgConnectionCard({ org, config, onConnect, onDisconnect }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [formData, setFormData] = useState({
    client_id: '',
    client_secret: '',
    org_url: '',
    alias: org.alias || `PermSync-${org.environment}`
  });

  const color = config?.color || 'var(--color-accent-blue)';

  const getErrorMessage = (err) => {
    const detail = err?.response?.data?.detail;
    const status = err?.response?.status;

    if (status === 502 || err?.code === 'ERR_NETWORK') {
      return '🔴 Backend server is not running. Start it with: uvicorn app.main:app --port 8000';
    }

    // Structured error from our API
    if (detail && typeof detail === 'object') {
      return `${detail.message}${detail.error_code ? ` (${detail.error_code})` : ''}`;
    }

    // String error
    if (typeof detail === 'string') {
      return detail;
    }

    return `❌ ${err?.message || 'Connection failed. Please try again.'}`;
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    try {
      await onConnect({ environment: org.environment, ...formData });
      setIsEditing(false);
      setConnectionError(null);
    } catch (e) {
      setConnectionError(getErrorMessage(e));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setConnectionError(null);
    await onDisconnect(org.environment);
  };

  const updateField = (field) => (e) => setFormData({ ...formData, [field]: e.target.value });

  return (
    <motion.div
      whileHover={{ y: -3 }}
      className="card overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between" style={{ background: `${color}08`, borderBottom: `1px solid ${color}25` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `${color}15` }}>
            {config?.icon}
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>{org.environment}</h3>
            <p className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>{config?.label}</p>
          </div>
        </div>
        <StatusBadge label={org.connected ? 'Connected' : 'Disconnected'} size="sm" pulse={org.connected} />
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col space-y-3">
        {org.connected && !isEditing ? (
          <>
            <InputField label="Org Name" value={org.org_name || org.alias} readOnly icon={Server} />
            <InputField label="Instance URL" value={org.instance_url} readOnly icon={ExternalLink} />
            <InputField label="Org Type" value={org.org_type} readOnly icon={Globe} />
            <div className="flex items-center gap-2 mt-1">
              <Shield size={11} style={{ color: 'var(--color-accent-blue)' }} />
              <span className="text-[10px] font-semibold" style={{ color: 'var(--color-accent-blue)' }}>
                OAuth 2.0 Client Credentials
              </span>
            </div>
            {org.error && <p className="text-xs mt-2" style={{ color: 'var(--color-status-error)' }}>{org.error}</p>}
          </>
        ) : (
          <>
            <InputField label="Org Alias" value={formData.alias} onChange={updateField('alias')} icon={Server} placeholder="My Dev Org" />

            {/* Connected App Credentials */}
            <div className="pt-1 pb-1">
              <p className="text-[9px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: 'var(--color-accent-blue)' }}>
                <Key size={10} /> Connected App Credentials
              </p>
              <div className="space-y-3">
                <InputField label="Client ID (Consumer Key)" value={formData.client_id} onChange={updateField('client_id')} icon={Key} placeholder="3MVG9..." />
                <InputField label="Client Secret (Consumer Secret)" type="password" value={formData.client_secret} onChange={updateField('client_secret')} icon={Lock} placeholder="Consumer Secret" />
              </div>
            </div>

            {/* Org URL */}
            <div className="pt-1 pb-1">
              <p className="text-[9px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1" style={{ color: 'var(--color-text-muted)' }}>
                <Globe size={10} /> Salesforce Org
              </p>
              <InputField label="Org URL" value={formData.org_url} onChange={updateField('org_url')} icon={ExternalLink} placeholder="mycompany.my.salesforce.com" />
            </div>
          </>
        )}

        {/* Inline Error Message */}
        {connectionError && (
          <div className="p-3 rounded-lg text-xs" style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#ef4444',
          }}>
            {connectionError}
          </div>
        )}

        <div className="flex gap-2 pt-2 mt-auto">
          {org.connected && !isEditing ? (
            <>
              <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium cursor-pointer"
                style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
                <RefreshCcw size={12} /> Refresh
              </button>
              <button onClick={handleDisconnect} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium cursor-pointer"
                style={{ background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <Unlink size={12} /> Disconnect
              </button>
            </>
          ) : (
            <>
              {isEditing && (
                <button onClick={() => setIsEditing(false)} className="flex-1 py-2.5 rounded-lg text-xs font-bold cursor-pointer"
                  style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-secondary)' }}>
                  Cancel
                </button>
              )}
              <button onClick={handleConnect} disabled={isConnecting} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50"
                style={{ background: 'var(--gradient-primary)', color: '#fff' }}>
                <Link2 size={14} /> {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function InputField({ label, value, onChange, type = "text", readOnly, icon: Icon, placeholder }) {
  return (
    <div>
      {label && <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color: 'var(--color-text-muted)' }}>{label}</label>}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-primary)' }}>
        {Icon && <Icon size={12} style={{ color: 'var(--color-text-muted)' }} />}
        <input
          type={type}
          value={value || ''}
          onChange={onChange}
          readOnly={readOnly}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-xs outline-none"
          style={{ color: 'var(--color-text-secondary)' }}
        />
      </div>
    </div>
  );
}
