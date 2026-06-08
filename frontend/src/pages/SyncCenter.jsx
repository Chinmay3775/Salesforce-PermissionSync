/**
 * SyncCenter — Permission synchronization with preview and execution.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, ArrowRight, CheckCircle2, XCircle, AlertTriangle, Play, Eye, RotateCcw, Clock, Loader2, Download } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { useSyncStore } from '../store';

const ai = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const ec = { DEV: 'var(--color-env-dev)', UAT: 'var(--color-env-uat)', PROD: 'var(--color-env-prod)' };

export default function SyncCenter() {
  const [sourceEnv, setSourceEnv] = useState('DEV');
  const [targetEnv, setTargetEnv] = useState('UAT');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [step, setStep] = useState(1);

  const preview = useSyncStore((s) => s.preview);
  const result = useSyncStore((s) => s.result);
  const history = useSyncStore((s) => s.history);
  const loading = useSyncStore((s) => s.loading);
  const previewSync = useSyncStore((s) => s.previewSync);
  const executeSync = useSyncStore((s) => s.executeSync);
  const fetchHistory = useSyncStore((s) => s.fetchHistory);

  // The sync items come from the preview (populated after clicking "Load Drifts")
  const syncItems = preview?.items || [];
  const syncHistory = history || [];

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const toggleItem = (id) => {
    setSelectedItems(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    selectedItems.size === syncItems.length ? setSelectedItems(new Set()) : setSelectedItems(new Set(syncItems.map(i=>i.id)));
  };

  const handleLoadDrifts = async () => {
    const data = await previewSync(sourceEnv, targetEnv, [], true);
    if (data?.items?.length > 0) {
      setSelectedItems(new Set(data.items.map(i => i.id)));
    }
  };

  const handleSync = async () => {
    setStep(2);
    const selected = Array.from(selectedItems);
    setStep(3);
    const res = await executeSync(sourceEnv, targetEnv, selected, false);
    setStep(4);
    // Refresh history after sync
    await fetchHistory();
  };

  const handleReset = () => {
    setStep(1);
    setSelectedItems(new Set());
  };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" style={{ color:'var(--color-text-primary)' }}>Sync Center</h2>
        <p className="text-sm mt-1" style={{ color:'var(--color-text-secondary)' }}>Synchronize permissions between environments</p>
      </div>

      {/* Env Selectors */}
      <div className="flex items-center gap-4">
        <EnvPicker label="Source" value={sourceEnv} onChange={setSourceEnv} />
        <div className="flex flex-col items-center">
          <ArrowRight size={24} style={{ color:'var(--color-accent-blue)' }} />
          <span className="text-[9px] mt-1" style={{ color:'var(--color-text-muted)' }}>SYNC</span>
        </div>
        <EnvPicker label="Target" value={targetEnv} onChange={setTargetEnv} />
        <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }} onClick={handleLoadDrifts} disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold ml-auto cursor-pointer disabled:opacity-50"
          style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-accent-blue)', border: '1px solid var(--color-accent-blue)30' }}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {loading ? 'Loading...' : 'Load Drifts'}
        </motion.button>
      </div>

      {/* Progress Steps */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-0">
          {['Select Items','Preview','Deploying','Complete'].map((s,i) => (
            <div key={s} className="flex-1 flex items-center">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold" style={{
                  background: step > i+1 ? 'var(--color-status-success)' : step === i+1 ? 'var(--color-accent-blue)' : 'var(--color-bg-input)',
                  color: step >= i+1 ? '#fff' : 'var(--color-text-muted)'
                }}>
                  {step > i+1 ? <CheckCircle2 size={14} /> : i+1}
                </div>
                <span className="text-[11px] font-medium" style={{ color: step >= i+1 ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>{s}</span>
              </div>
              {i < 3 && <div className="flex-1 h-px mx-3" style={{ background: step > i+1 ? 'var(--color-status-success)' : 'var(--color-border-primary)' }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Sync Items */}
        <div className="col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color:'var(--color-text-tertiary)' }}>
              Items to Sync ({selectedItems.size}/{syncItems.length})
            </h3>
            {syncItems.length > 0 && (
              <button onClick={toggleAll} className="text-[10px] font-medium px-3 py-1 rounded cursor-pointer" style={{ background:'var(--color-accent-blue)15', color:'var(--color-accent-blue)' }}>
                {selectedItems.size === syncItems.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
          <div className="space-y-2" style={{ maxHeight:'45vh', overflowY:'auto' }}>
            {syncItems.length > 0 ? (
              syncItems.map(si => (
                <motion.div key={si.id} whileHover={{ x:2 }} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
                  style={{ background: selectedItems.has(si.id) ? 'var(--color-accent-blue)08' : 'var(--color-bg-secondary)', border: `1px solid ${selectedItems.has(si.id) ? 'var(--color-accent-blue)30' : 'var(--color-border-primary)'}` }}
                  onClick={() => toggleItem(si.id)}>
                  <input type="checkbox" checked={selectedItems.has(si.id)} readOnly className="w-4 h-4 rounded accent-blue-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-medium" style={{ color:'var(--color-text-primary)' }}>{si.item}</span>
                      <StatusBadge label={si.severity} size="xs" />
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color:'var(--color-text-muted)' }}>{si.category} • {si.profile} • {si.action}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{si.status}</p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                {loading ? 'Loading drift items...' : 'No sync items loaded. Click "Load Drifts" to fetch differences from a prior comparison.'}
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-4 pt-4" style={{ borderTop:'1px solid var(--color-border-primary)' }}>
            {step === 4 ? (
              <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.99 }} onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold cursor-pointer"
                style={{ background:'var(--color-bg-elevated)', color:'var(--color-accent-blue)', border:'1px solid var(--color-accent-blue)30' }}>
                <RotateCcw size={14} /> Reset
              </motion.button>
            ) : (
              <>
                <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.99 }} onClick={handleLoadDrifts} disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40"
                  style={{ background:'var(--color-bg-elevated)', color:'var(--color-accent-blue)', border:'1px solid var(--color-accent-blue)30' }}>
                  <Eye size={14} /> Preview
                </motion.button>
                <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.99 }} onClick={handleSync} disabled={selectedItems.size===0 || loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold cursor-pointer disabled:opacity-40"
                  style={{ background:'var(--gradient-primary)', color:'#fff' }}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  {loading ? 'Syncing...' : step === 4 ? 'Synced!' : 'Execute Sync'}
                </motion.button>
              </>
            )}
          </div>

          {/* Sync Result Summary */}
          {result && step === 4 && (
            <div className="mt-4 p-4 rounded-lg" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)' }}>
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 size={16} style={{ color: 'var(--color-status-success)' }} />
                <span className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Sync {result.status}
                </span>
              </div>
              <div className="flex gap-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span><CheckCircle2 size={10} className="inline mr-1" style={{ color:'var(--color-status-success)' }} />{result.items_synced} synced</span>
                {result.items_failed > 0 && <span><XCircle size={10} className="inline mr-1" style={{ color:'var(--color-status-error)' }} />{result.items_failed} failed</span>}
              </div>
            </div>
          )}
        </div>

        {/* Sync History */}
        <div className="glass-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color:'var(--color-text-tertiary)' }}>Sync History</h3>
          <div className="space-y-3">
            {syncHistory.length > 0 ? (
              syncHistory.map((h, idx) => (
                <div key={h.sync_id || idx} className="p-3 rounded-lg" style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border-primary)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold px-1.5 rounded" style={{ background:`${ec[h.source_env]}20`, color:ec[h.source_env] }}>{h.source_env}</span>
                      <ArrowRight size={8} style={{ color:'var(--color-text-muted)' }} />
                      <span className="text-[9px] font-bold px-1.5 rounded" style={{ background:`${ec[h.target_env]}20`, color:ec[h.target_env] }}>{h.target_env}</span>
                    </div>
                    <StatusBadge label={h.items_failed > 0 ? 'Warning' : 'Success'} size="xs" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color:'var(--color-text-secondary)' }}>
                      <CheckCircle2 size={10} className="inline mr-1" style={{ color:'var(--color-status-success)' }} />{h.items_synced} synced
                      {h.items_failed > 0 && <><XCircle size={10} className="inline ml-2 mr-1" style={{ color:'var(--color-status-error)' }} />{h.items_failed} failed</>}
                    </span>
                    <span className="text-[9px]" style={{ color:'var(--color-text-muted)' }}>{h.synced_at ? new Date(h.synced_at).toLocaleString() : ''}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                No past sync executions.
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function EnvPicker({ label, value, onChange }) {
  return (
    <div className="glass-card p-4 flex-1">
      <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color:'var(--color-text-muted)' }}>{label}</p>
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="w-full bg-transparent text-lg font-bold outline-none cursor-pointer" style={{ color:ec[value] }}>
        {['DEV','UAT','PROD'].map(e=><option key={e} value={e} style={{ background:'#1a2035' }}>{e}</option>)}
      </select>
    </div>
  );
}
