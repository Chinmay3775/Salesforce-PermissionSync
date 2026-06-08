/**
 * MetadataRetrieval — Fetch and browse Salesforce metadata.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Download, CheckCircle2, Loader2, ChevronRight,
  ChevronDown, FileJson, FolderOpen, Shield, Key, Eye
} from 'lucide-react';
import { useMetadataStore } from '../store';
import { ProgressBar } from '../components/StatusBadge';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const envColors = { DEV: 'var(--color-env-dev)', UAT: 'var(--color-env-uat)', PROD: 'var(--color-env-prod)' };

const metadataCategories = [
  { id: 'profiles', label: 'Profiles', icon: Shield, description: 'User profiles with field-level security' },
  { id: 'permissionSets', label: 'Permission Sets', icon: Key, description: 'Permission set configurations' },
  { id: 'objectPermissions', label: 'Object Permissions', icon: Database, description: 'CRUD access on objects' },
  { id: 'fieldPermissions', label: 'Field-Level Security', icon: Eye, description: 'Field read/edit permissions' },
  { id: 'classAccesses', label: 'Apex Class Access', icon: FileJson, description: 'Apex class visibility settings' },
  { id: 'tabVisibilities', label: 'Tab Visibilities', icon: FolderOpen, description: 'Tab default visibility' },
];

export default function MetadataRetrieval() {
  const [selectedEnv, setSelectedEnv] = useState('DEV');
  const [selectedCategories, setSelectedCategories] = useState(new Set(metadataCategories.map(c => c.id)));
  const [isFetching, setIsFetching] = useState(false);
  const [logs, setLogs] = useState([]);

  const metadata = useMetadataStore((s) => s.metadata);
  const fetchProgress = useMetadataStore((s) => s.fetchProgress);
  const fetchMetadata = useMetadataStore((s) => s.fetchMetadata);

  const toggleCategory = (id) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleFetch = async () => {
    setIsFetching(true);
    setLogs([]);

    setLogs([
      `[${new Date().toLocaleTimeString()}] Connecting to ${selectedEnv} org...`,
      `[${new Date().toLocaleTimeString()}] Authenticating and retrieving metadata...`
    ]);

    const result = await fetchMetadata(selectedEnv);

    if (result) {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ✓ Connection established`,
        `[${new Date().toLocaleTimeString()}] ✓ Retrieved ${result.profiles_count || 0} profiles`,
        `[${new Date().toLocaleTimeString()}] ✓ Retrieved ${result.permission_sets_count || 0} permission sets`,
        `[${new Date().toLocaleTimeString()}] ✓ Total: ${result.total_field_permissions || 0} field permissions`,
        `[${new Date().toLocaleTimeString()}] ✅ Metadata retrieval complete!`,
      ]);
    } else {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ❌ Failed to fetch metadata. Please ensure the org is connected.`,
      ]);
    }
    setIsFetching(false);
  };

  const envData = metadata[selectedEnv];
  const progress = fetchProgress[selectedEnv] || 0;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
            Metadata Retrieval
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Fetch and store Salesforce metadata from connected environments
          </p>
        </div>
      </motion.div>

      {/* Environment Selector Tabs */}
      <motion.div variants={item} className="flex gap-2">
        {['DEV', 'UAT', 'PROD'].map((env) => (
          <button
            key={env}
            onClick={() => setSelectedEnv(env)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            style={{
              background: selectedEnv === env ? `${envColors[env]}15` : 'var(--color-bg-card)',
              color: selectedEnv === env ? envColors[env] : 'var(--color-text-tertiary)',
              border: `1px solid ${selectedEnv === env ? `${envColors[env]}40` : 'var(--color-border-primary)'}`,
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: envColors[env] }} />
            {env}
            {metadata[env] && <CheckCircle2 size={12} />}
          </button>
        ))}
      </motion.div>

      <div className="grid grid-cols-5 gap-6">
        {/* Left — Categories + Fetch */}
        <motion.div variants={item} className="col-span-2 space-y-4">
          <div className="glass-card p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-tertiary)' }}>
              Metadata Categories
            </h3>
            <div className="space-y-2">
              {metadataCategories.map((cat) => (
                <label
                  key={cat.id}
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{ border: '1px solid var(--color-border-primary)' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.has(cat.id)}
                    onChange={() => toggleCategory(cat.id)}
                    className="w-4 h-4 rounded accent-blue-500"
                  />
                  <cat.icon size={14} style={{ color: envColors[selectedEnv] }} />
                  <div>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{cat.label}</p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{cat.description}</p>
                  </div>
                </label>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleFetch}
              disabled={isFetching}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold cursor-pointer disabled:opacity-50"
              style={{ background: 'var(--gradient-primary)', color: '#fff' }}
            >
              {isFetching ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {isFetching ? 'Fetching...' : `Fetch from ${selectedEnv}`}
            </motion.button>

            {isFetching && (
              <div className="mt-3">
                <ProgressBar value={progress} color={envColors[selectedEnv]} />
                <p className="text-[10px] mt-1 text-center" style={{ color: 'var(--color-text-muted)' }}>{progress}%</p>
              </div>
            )}
          </div>

          {/* Metadata Summary */}
          {envData && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
                Retrieved Summary — {selectedEnv}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Profiles', value: envData.profiles_count },
                  { label: 'Permission Sets', value: envData.permission_sets_count },
                  { label: 'Field Permissions', value: envData.total_field_permissions },
                  { label: 'Object Permissions', value: envData.total_object_permissions },
                ].map((m) => (
                  <div key={m.label} className="p-3 rounded-lg" style={{ background: 'var(--color-bg-secondary)' }}>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{m.label}</p>
                    <p className="text-lg font-bold" style={{ color: envColors[selectedEnv] }}>{m.value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>

        {/* Right — Logs Panel */}
        <motion.div variants={item} className="col-span-3 glass-card p-5 flex flex-col" style={{ maxHeight: '70vh' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
            Retrieval Log
          </h3>
          <div className="flex-1 overflow-y-auto rounded-lg p-4 font-mono text-xs space-y-1 scrollbar-thin" style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-primary)' }}>
            {logs.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)' }}>Awaiting fetch command...</p>
            ) : (
              logs.map((log, i) => (
                <motion.p
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ color: log.includes('✓') || log.includes('✅') ? 'var(--color-status-success)' : log.includes('Error') ? 'var(--color-status-error)' : 'var(--color-text-secondary)' }}
                >
                  {log}
                </motion.p>
              ))
            )}
            {isFetching && (
              <motion.p animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} style={{ color: 'var(--color-accent-cyan)' }}>
                ▌
              </motion.p>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
