import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ArrowLeft, Bot, Upload, Plus, Trash2,
  CheckCircle2, AlertTriangle, ArrowLeftRight, RefreshCw,
  Zap, GitCompare, Users, FileText, ChevronDown, ChevronUp,
  ShieldCheck, ShieldX, Minus, X
} from 'lucide-react';
import {
  getProfiles,
  runAgent,
  approveAgentActions,
} from '../services/api';
import * as XLSX from 'xlsx';

// ─── Stage metadata ───────────────────────────────────────────────────────────
const STAGES = [
  { id: 1, label: 'Environments',    icon: ArrowLeftRight },
  { id: 2, label: 'Components',      icon: FileText       },
  { id: 3, label: 'Profile Mapping', icon: Users          },
  { id: 4, label: 'Results',         icon: GitCompare     },
];

// ─── Status badge config ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  'Missing in Target': {
    label: '✕ Missing',
    className: 'bg-[var(--color-status-error-bg)] text-[var(--color-status-error)]',
    icon: ShieldX,
  },
  'Missing in Source': {
    label: '✕ Missing',
    className: 'bg-[var(--color-status-error-bg)] text-[var(--color-status-error)]',
    icon: Minus,
  },
  'Mismatch': {
    label: '⚠ Different',
    className: 'bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning)]',
    icon: AlertTriangle,
  },
  'Match': {
    label: '✓ Same',
    className: 'bg-[var(--color-status-success-bg)] text-[var(--color-status-success)]',
    icon: ShieldCheck,
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeKey(k) {
  return String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function extractType(item) {
  let rawType = 'ApexClass';
  const priorities = ['componenttype', 'type'];
  for (const p of priorities) {
    for (const [k, v] of Object.entries(item)) {
      if (normalizeKey(k) === p && v) { rawType = String(v).trim(); break; }
    }
    if (rawType !== 'ApexClass') break;
  }
  const norm = rawType.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (norm === 'customobject') return 'CustomObject';
  if (norm === 'customfield')  return 'CustomField';
  if (norm === 'apexclass')    return 'ApexClass';
  return rawType;
}

function extractName(item) {
  const priorities = ['componentapiname', 'apiname', 'developername', 'name', 'componentname'];
  for (const p of priorities) {
    for (const [k, v] of Object.entries(item)) {
      if (normalizeKey(k) === p && v) return String(v).trim();
    }
  }
  return '';
}

function extractObjectName(item) {
  const priorities = ['objectname', 'object', 'sobject', 'parentobject'];
  for (const p of priorities) {
    for (const [k, v] of Object.entries(item)) {
      if (normalizeKey(k) === p && v) return String(v).trim();
    }
  }
  return '';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 select-none">
      {STAGES.map((s, i) => {
        const done   = current > s.id;
        const active = current === s.id;
        const Icon   = s.icon;
        return (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                done   ? 'bg-[var(--color-accent-blue)] border-[var(--color-accent-blue)] text-white' :
                active ? 'bg-[var(--color-accent-blue)]/20 border-[var(--color-accent-blue)] text-[var(--color-accent-blue)]' :
                         'bg-[var(--color-bg-tertiary)] border-[var(--color-border-primary)] text-[var(--color-text-muted)]'
              }`}>
                {done
                  ? <CheckCircle2 size={16} />
                  : <Icon size={15} />
                }
              </div>
              <span className={`text-[10px] font-medium tracking-wide whitespace-nowrap transition-colors duration-300 ${
                active ? 'text-[var(--color-accent-blue)]' : done ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-muted)]'
              }`}>
                {s.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`h-px w-16 mx-2 mb-5 transition-colors duration-500 ${
                done ? 'bg-[var(--color-accent-blue)]' : 'bg-[var(--color-border-primary)]'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({ title, children, footer }) {
  return (
    <div className="card overflow-hidden">
      {title && (
        <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-bg-secondary)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>{title}</h2>
        </div>
      )}
      <div className="p-6">{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-bg-tertiary)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

function Btn({ onClick, disabled, variant = 'primary', children, className = '' }) {
  const variants = {
    primary:  'btn-primary',
    success:  'btn-primary !bg-[var(--color-status-success)]',
    ghost:    'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]',
    outline:  'btn-secondary',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`flex items-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant] || 'btn-primary'} ${className}`}>
      {children}
    </button>
  );
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}

function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-300"
    >
      <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-400" />
      {message}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CompareWorkflow() {
  // Stage state
  const [stage, setStage]     = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Stage 1 — Environments
  const [sourceEnv, setSourceEnv] = useState('DEV');
  const [targetEnv, setTargetEnv] = useState('UAT');

  // Stage 2 — Deployment Sheet
  const [components, setComponents] = useState([{ type: 'ApexClass', name: '', objectName: '' }]);
  const fileInputRef = useRef(null);

  // Stage 3 — Profile Mapping
  const [sourceProfiles, setSourceProfiles] = useState([]);
  const [targetProfiles, setTargetProfiles] = useState([]);
  const [selectedProfiles, setSelectedProfiles] = useState(new Set());
  const [profilesLoading, setProfilesLoading] = useState(false);

  // Stage 4 — Results
  const [actionPlan, setActionPlan]           = useState([]);
  const [compSummary, setCompSummary]         = useState({});
  const [selectedActions, setSelectedActions] = useState(new Set());
  const [syncResult, setSyncResult]           = useState(null);
  const [expandedRows, setExpandedRows]       = useState(new Set());
  const [syncing, setSyncing]                 = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const clearError = () => setError('');

  const go = (n) => { clearError(); setStage(n); };

  const reset = () => {
    setStage(1);
    setComponents([{ type: 'ApexClass', name: '', objectName: '' }]);
    setSelectedProfiles(new Set());
    setSourceProfiles([]); setTargetProfiles([]);
    setActionPlan([]); setCompSummary({});
    setSelectedActions(new Set());
    setSyncResult(null);
    setExpandedRows(new Set());
    clearError();
  };

  // ── Stage 2 — Component table handlers ────────────────────────────────────

  const addComponent = () =>
    setComponents([...components, { type: 'ApexClass', name: '', objectName: '' }]);

  const removeComponent = (i) => {
    if (components.length === 1) return;
    setComponents(components.filter((_, idx) => idx !== i));
  };

  const updateComponent = (i, field, value) => {
    const c = [...components];
    c[i] = { ...c[i], [field]: value };
    setComponents(c);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        let parsed = [];
        if (file.name.match(/\.xlsx?$/i)) {
          const wb  = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
          const ws  = wb.Sheets[wb.SheetNames[0]];
          parsed    = XLSX.utils.sheet_to_json(ws);
        } else if (file.name.endsWith('.json')) {
          parsed = JSON.parse(ev.target.result);
        } else if (file.name.endsWith('.csv')) {
          const lines = ev.target.result.split(/\r?\n/);
          lines.forEach((line, idx) => {
            const parts = line.split(',');
            if (parts.length >= 2) {
              const t = parts[0].trim(), n = parts[1].trim();
              if (idx === 0 && t.toLowerCase().includes('type')) return;
              if (t && n) parsed.push({ type: t, name: n });
            }
          });
          if (parsed.length) {
            const keep = components.filter(c => c.name);
            setComponents([...keep, ...parsed]);
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
          }
        }
        if (Array.isArray(parsed) && parsed.length) {
          const newComps = parsed
            .map(item => ({ 
              type: extractType(item), 
              name: extractName(item),
              objectName: extractObjectName(item)
            }))
            .filter(c => c.type && c.name);
          if (newComps.length) {
            const keep = components.filter(c => c.name);
            setComponents([...keep, ...newComps]);
          } else {
            setError('No valid components found in the uploaded file.');
          }
        }
      } catch (err) {
        setError('Error parsing file: ' + err.message);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    file.name.match(/\.xlsx?$/i) ? reader.readAsArrayBuffer(file) : reader.readAsText(file);
  };

  // ── Stage 3 — Profile loading & mapping ───────────────────────────────────

  const loadProfiles = useCallback(async () => {
    setProfilesLoading(true);
    clearError();
    try {
      const [srcRes, tgtRes] = await Promise.all([
        getProfiles(sourceEnv),
        getProfiles(targetEnv),
      ]);
      setSourceProfiles(srcRes.data.profiles || []);
      setTargetProfiles(tgtRes.data.profiles || []);
    } catch (err) {
      const detail = err.response?.data?.detail || err.message;
      setError(`Failed to load profiles: ${detail}`);
    } finally {
      setProfilesLoading(false);
    }
  }, [sourceEnv, targetEnv]);

  const toggleProfileSelect = (name) => {
    const s = new Set(selectedProfiles);
    s.has(name) ? s.delete(name) : s.add(name);
    setSelectedProfiles(s);
  };

  const selectAllProfiles = (profiles) => {
    const s = new Set(selectedProfiles);
    const allSelected = profiles.every(p => s.has(p.name));
    if (allSelected) {
      profiles.forEach(p => s.delete(p.name));
    } else {
      profiles.forEach(p => s.add(p.name));
    }
    setSelectedProfiles(s);
  };

  // Derived for profile checklist
  const targetProfileNames = new Set(targetProfiles.map(p => p.name));
  const presentSourceProfiles = sourceProfiles.filter(p => targetProfileNames.has(p.name));
  const missingSourceProfiles = sourceProfiles.filter(p => !targetProfileNames.has(p.name));

  const standardProfiles = presentSourceProfiles.filter(p => !p.is_custom);
  const customProfiles = presentSourceProfiles.filter(p => p.is_custom);

  // ── Stage 3 → 4: Run comparison ───────────────────────────────────────────

  const handleRunComparison = async () => {
    const validComponents = components
      .filter(c => c.name.trim() !== '')
      .map(c => ({
        type: c.type,
        name: c.type === 'CustomField' ? `${c.objectName}.${c.name}` : c.name
      }));
      
    if (!validComponents.length) { setError('Add at least one component.'); return; }

    const validMapping = Array.from(selectedProfiles).map(name => ({
      source_profile: name,
      target_profile: name
    }));
    
    if (!validMapping.length) { setError('Select at least one profile.'); return; }

    setLoading(true); clearError();
    try {
      const res = await runAgent({
        source_env:       sourceEnv,
        target_env:       targetEnv,
        deployment_sheet: validComponents,
        profile_mapping:  validMapping,
      });
      setActionPlan(res.data.action_plan || []);
      setCompSummary(res.data.comparison_summary || {});
      const allIds = new Set((res.data.action_plan || []).map(a => a.action_id));
      setSelectedActions(allIds);
      go(4);
    } catch (err) {
      setError(err.response?.data?.detail || 'Comparison failed. Check org connections.');
    } finally {
      setLoading(false);
    }
  };

  // ── Stage 4: Sync selected ─────────────────────────────────────────────────

  const handleSync = async () => {
    const approved = actionPlan.filter(a => selectedActions.has(a.action_id));
    if (!approved.length) { setError('Select at least one action to sync.'); return; }

    setSyncing(true); clearError();
    try {
      const res = await approveAgentActions({ target_env: targetEnv, approved_actions: approved });
      setSyncResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const toggleRow = (id) => {
    const s = new Set(expandedRows);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpandedRows(s);
  };

  const toggleSelect = (id) => {
    const s = new Set(selectedActions);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedActions(s);
  };

  // ── Derived ────────────────────────────────────────────────────────────────


  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-1" style={{ color: 'var(--color-text-primary)' }}>
            <Bot size={24} style={{ color: 'var(--color-accent-blue)' }} />
            Permission Comparison Workflow
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Connect orgs → define components → map profiles → compare & sync.
          </p>
        </div>
        {stage > 1 && (
          <Btn variant="outline" onClick={reset} className="text-xs">
            <RefreshCw size={13} /> Start Over
          </Btn>
        )}
      </div>

      {/* Step indicator */}
      <StepIndicator current={stage} />

      <ErrorBanner message={error} />

      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════════════════
            STAGE 1 — ENVIRONMENT SELECTION
        ══════════════════════════════════════════════════ */}
        {stage === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <SectionCard
              title="Step 1 — Select Environments"
              footer={
                <>
                  <span className="text-xs text-gray-500">Make sure both orgs are connected on the Connections page.</span>
                  <Btn onClick={() => {
                    if (sourceEnv === targetEnv) { setError('Source and target must be different environments.'); return; }
                    go(2);
                  }}>
                    Next <ArrowRight size={15} />
                  </Btn>
                </>
              }
            >
              <div className="grid grid-cols-2 gap-8">
                {[
                  { label: 'Source Environment', value: sourceEnv, onChange: setSourceEnv, color: 'text-purple-400', desc: 'The org whose permissions are the "ground truth"' },
                  { label: 'Target Environment', value: targetEnv, onChange: setTargetEnv, color: 'text-amber-400',   desc: 'The org to compare against (and optionally fix)' },
                ].map(({ label, value, onChange, color, desc }) => (
                  <div key={label} className="space-y-3">
                    <label className={`text-xs font-semibold uppercase tracking-widest ${color}`}>{label}</label>
                    <select
                      value={value}
                      onChange={e => onChange(e.target.value)}
                      className="w-full border rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/40 outline-none transition-all cursor-pointer"
                      style={{ background: 'var(--color-bg-input)', color: 'var(--color-text-primary)', borderColor: 'var(--color-border-primary)' }}
                    >
                      {['DEV', 'UAT', 'PROD'].map(e => (
                        <option key={e} value={e} style={{ background: 'var(--color-bg-card)' }}>{e}</option>
                      ))}
                    </select>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
                  </div>
                ))}
              </div>

              {/* Visual connector */}
              <div className="flex items-center justify-center gap-4 mt-8">
                <div className="px-4 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm font-semibold">{sourceEnv}</div>
                <div className="flex items-center gap-1 text-gray-500">
                  <div className="h-px w-8 bg-gray-700" />
                  <ArrowLeftRight size={16} />
                  <div className="h-px w-8 bg-gray-700" />
                </div>
                <div className="px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm font-semibold">{targetEnv}</div>
              </div>
            </SectionCard>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════
            STAGE 2 — DEPLOYMENT SHEET
        ══════════════════════════════════════════════════ */}
        {stage === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <SectionCard
              title="Step 2 — Define Deployed Components"
              footer={
                <>
                  <Btn variant="ghost" onClick={() => go(1)}>
                    <ArrowLeft size={15} /> Back
                  </Btn>
                  <Btn onClick={async () => {
                    const valid = components.filter(c => c.name.trim());
                    if (!valid.length) { setError('Add at least one component.'); return; }
                    clearError();
                    setLoading(true);
                    await loadProfiles();
                    setLoading(false);
                    go(3);
                  }} disabled={loading}>
                    {loading ? <><Spinner /> Loading Profiles…</> : <>Next <ArrowRight size={15} /></>}
                  </Btn>
                </>
              }
            >
              {/* Upload bar */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Enter components from your deployment sheet, or upload a file.</p>
                <div className="flex items-center gap-3">
                  <input type="file" accept=".csv,.json,.xlsx,.xls" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 font-medium transition-colors"
                  >
                    <Upload size={13} /> Upload File
                  </button>
                  <button
                    onClick={addComponent}
                    className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    <Plus size={13} /> Add Row
                  </button>
                </div>
              </div>

              {/* Component table */}
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-border-primary)' }}>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wider" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }}>
                      <th className="py-2.5 px-4 font-medium border-b w-1/4" style={{ borderColor: 'var(--color-border-primary)' }}>Component Type</th>
                      <th className="py-2.5 px-4 font-medium border-b w-1/4" style={{ borderColor: 'var(--color-border-primary)' }}>Object Name</th>
                      <th className="py-2.5 px-4 font-medium border-b" style={{ borderColor: 'var(--color-border-primary)' }}>API Name</th>
                      <th className="py-2.5 px-4 font-medium border-b w-14 text-center" style={{ borderColor: 'var(--color-border-primary)' }}>Del</th>
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((c, i) => (
                      <tr key={i} className="border-b transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderColor: 'var(--color-border-primary)' }}>
                        <td className="p-2 pl-4">
                          <select
                            value={c.type}
                            onChange={e => updateComponent(i, 'type', e.target.value)}
                            className="bg-transparent border-none text-sm focus:ring-0 outline-none cursor-pointer w-full"
                            style={{ color: 'var(--color-text-primary)' }}
                          >
                            {['ApexClass', 'CustomField', 'CustomObject'].map(t => (
                              <option key={t} value={t} style={{ background: 'var(--color-bg-card)' }}>{t}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder={c.type === 'CustomField' ? "e.g. Account" : "-"}
                            value={c.objectName}
                            onChange={e => updateComponent(i, 'objectName', e.target.value)}
                            disabled={c.type !== 'CustomField'}
                            style={{ opacity: c.type === 'CustomField' ? 1 : 0.3, color: 'var(--color-text-primary)' }}
                            className="w-full bg-transparent border-none text-sm focus:ring-0 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            placeholder={c.type === 'CustomField' ? "e.g. Status__c" : "e.g. EmailController"}
                            value={c.name}
                            onChange={e => updateComponent(i, 'name', e.target.value)}
                            className="w-full bg-transparent border-none text-sm focus:ring-0 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600"
                            style={{ color: 'var(--color-text-primary)' }}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => removeComponent(i)}
                            disabled={components.length === 1}
                            className="p-1.5 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors disabled:opacity-30"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>{components.filter(c => c.name).length} valid component(s)</p>
            </SectionCard>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════
            STAGE 3 — PROFILE MAPPING
        ══════════════════════════════════════════════════ */}
        {stage === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <Users size={16} className="text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="text-blue-700 dark:text-blue-300 font-medium mb-0.5">Map profiles between orgs</p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Profile names often differ between environments (e.g. <span className="font-mono text-[11px]" style={{ color: 'var(--color-text-primary)' }}>Sales User</span> in {sourceEnv} vs <span className="font-mono text-[11px]" style={{ color: 'var(--color-text-primary)' }}>Sales_UAT</span> in {targetEnv}).
                  Tell us which source profile corresponds to which target profile.
                  Only mapped pairs will be compared.
                </p>
              </div>
            </div>

            <SectionCard
              title="Step 3 — Profile Mapping"
              footer={
                <>
                  <Btn variant="ghost" onClick={() => go(2)}>
                    <ArrowLeft size={15} /> Back
                  </Btn>
                  <div className="flex items-center gap-3">
                    <Btn
                      onClick={handleRunComparison}
                      disabled={loading || selectedProfiles.size === 0}
                    >
                      {loading
                        ? <><Spinner /> Comparing…</>
                        : <><Zap size={15} /> Run Comparison</>
                      }
                    </Btn>
                  </div>
                </>
              }
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{sourceProfiles.length}</span> profiles in {sourceEnv} &nbsp;·&nbsp;
                  <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{targetProfiles.length}</span> profiles in {targetEnv}
                  {profilesLoading && <RefreshCw size={12} className="animate-spin text-blue-500 dark:text-blue-400" />}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadProfiles}
                    disabled={profilesLoading}
                    className="text-xs flex items-center gap-1 transition-colors hover:opacity-70"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    <RefreshCw size={12} className={profilesLoading ? 'animate-spin' : ''} /> Refresh
                  </button>
                </div>
              </div>

              {/* Profile Checklists */}
              <div className="grid grid-cols-3 gap-6">
                {/* Standard Profiles */}
                <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-bg-card)' }}>
                  <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-bg-secondary)' }}>
                    <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Standard Profiles</h3>
                    <button 
                      onClick={() => selectAllProfiles(standardProfiles)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      Select All
                    </button>
                  </div>
                  <div className="p-2 max-h-60 overflow-y-auto space-y-1">
                    {standardProfiles.map(p => (
                      <label key={p.name} className="flex items-center gap-2 px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedProfiles.has(p.name)}
                          onChange={() => toggleProfileSelect(p.name)}
                          className="rounded border-gray-300 dark:border-gray-600 bg-transparent text-blue-500 focus:ring-blue-500/50"
                        />
                        <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{p.name}</span>
                      </label>
                    ))}
                    {standardProfiles.length === 0 && <p className="text-xs p-2" style={{ color: 'var(--color-text-muted)' }}>No standard profiles found.</p>}
                  </div>
                </div>

                {/* Custom Profiles */}
                <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-bg-card)' }}>
                  <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-bg-secondary)' }}>
                    <h3 className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Custom Profiles</h3>
                    <button 
                      onClick={() => selectAllProfiles(customProfiles)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      Select All
                    </button>
                  </div>
                  <div className="p-2 max-h-60 overflow-y-auto space-y-1">
                    {customProfiles.map(p => (
                      <label key={p.name} className="flex items-center gap-2 px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded cursor-pointer transition-colors">
                        <input 
                          type="checkbox" 
                          checked={selectedProfiles.has(p.name)}
                          onChange={() => toggleProfileSelect(p.name)}
                          className="rounded border-gray-300 dark:border-gray-600 bg-transparent text-blue-500 focus:ring-blue-500/50"
                        />
                        <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{p.name}</span>
                      </label>
                    ))}
                    {customProfiles.length === 0 && <p className="text-xs p-2" style={{ color: 'var(--color-text-muted)' }}>No custom profiles found.</p>}
                  </div>
                </div>

                {/* Missing Profiles */}
                <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-bg-card)' }}>
                  <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--color-border-primary)', background: 'var(--color-bg-secondary)' }}>
                    <h3 className="text-sm font-medium text-red-500 dark:text-red-400 flex items-center gap-1.5"><ShieldX size={15}/> Missing in Target</h3>
                  </div>
                  <div className="p-2 max-h-60 overflow-y-auto space-y-1">
                    {missingSourceProfiles.map(p => (
                      <div key={p.name} className="flex items-center gap-2 px-2 py-1.5 rounded opacity-60 bg-red-500/5">
                        <span className="text-sm line-through" style={{ color: 'var(--color-text-muted)' }}>{p.name}</span>
                      </div>
                    ))}
                    {missingSourceProfiles.length === 0 && <p className="text-xs p-2" style={{ color: 'var(--color-text-muted)' }}>No missing profiles.</p>}
                  </div>
                </div>
              </div>

              {selectedProfiles.size > 0 && (
                <div className="mt-4 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                  {selectedProfiles.size} profile{selectedProfiles.size !== 1 ? 's' : ''} selected for comparison.
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════
            STAGE 4 — RESULTS & SYNC
        ══════════════════════════════════════════════════ */}
        {stage === 4 && !syncResult && (
          <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            {/* Summary cards */}
            {compSummary && (
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Total Checked',       value: compSummary.total_compared  ?? 0, color: 'text-gray-300',   bg: 'bg-gray-800/40',    border: 'border-gray-700/50' },
                  { label: 'Missing in Target',   value: compSummary.missing_in_target ?? 0, color: 'text-red-400',   bg: 'bg-red-500/8',      border: 'border-red-500/20'  },
                  { label: 'Mismatches',           value: compSummary.mismatches       ?? 0, color: 'text-orange-400', bg: 'bg-orange-500/8',   border: 'border-orange-500/20'},
                  { label: 'Matches',              value: compSummary.matches          ?? 0, color: 'text-emerald-400',bg: 'bg-emerald-500/8',  border: 'border-emerald-500/20'},
                ].map(({ label, value, color, bg, border }) => (
                  <div key={label} className={`${bg} border ${border} rounded-xl p-4 text-center`}>
                    <div className={`text-3xl font-bold ${color} mb-1`}>{value}</div>
                    <div className="text-xs text-gray-500 font-medium">{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Env comparison header */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 font-semibold text-xs">{sourceEnv}</span>
              <ArrowRight size={14} />
              <span className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 font-semibold text-xs">{targetEnv}</span>
              <span className="ml-2 text-xs text-gray-600">·</span>
              <span className="text-xs text-gray-500">{actionPlan.length} difference{actionPlan.length !== 1 ? 's' : ''} found</span>
            </div>

            {/* Results table */}
            <div className="bg-[#1a1b1e] border border-gray-800 rounded-xl overflow-hidden shadow-lg">
              {/* Toolbar */}
              <div className="px-5 py-3.5 border-b border-gray-800 bg-gray-800/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="selectAll"
                    checked={selectedActions.size === actionPlan.length && actionPlan.length > 0}
                    onChange={e => setSelectedActions(
                      e.target.checked ? new Set(actionPlan.map(a => a.action_id)) : new Set()
                    )}
                    className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/30 cursor-pointer"
                  />
                  <label htmlFor="selectAll" className="text-xs text-gray-400 cursor-pointer">
                    {selectedActions.size > 0 ? `${selectedActions.size} selected` : 'Select all'}
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <Btn variant="ghost" onClick={() => go(3)} className="text-xs">
                    <ArrowLeft size={13} /> Back
                  </Btn>
                  <Btn
                    variant="success"
                    onClick={handleSync}
                    disabled={syncing || selectedActions.size === 0 || actionPlan.length === 0}
                  >
                    {syncing ? <><Spinner /> Syncing…</> : <><Zap size={14} /> Sync {selectedActions.size > 0 ? `(${selectedActions.size})` : ''}</>}
                  </Btn>
                </div>
              </div>

              {actionPlan.length === 0 ? (
                <div className="py-20 text-center">
                  <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-4" />
                  <p className="text-white font-semibold mb-1">All permissions are in sync!</p>
                  <p className="text-sm text-gray-500">No differences found for the specified components and profile pairs.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm relative">
                    <thead className="sticky top-0 z-10" style={{ background: 'var(--color-bg-tertiary)' }}>
                      <tr className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
                        <th className="py-3 px-4 w-10 border-b" style={{ borderColor: 'var(--color-border-primary)' }} />
                        <th className="py-3 px-4 border-b" style={{ borderColor: 'var(--color-border-primary)' }}>Source Org ({sourceEnv})</th>
                        <th className="py-3 px-4 border-b" style={{ borderColor: 'var(--color-border-primary)' }}>Component</th>
                        <th className="py-3 px-4 border-b" style={{ borderColor: 'var(--color-border-primary)' }}>Target Org ({targetEnv})</th>
                        <th className="py-3 px-4 w-10 border-b" style={{ borderColor: 'var(--color-border-primary)' }} />
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: 'var(--color-border-primary)' }}>
                      {actionPlan.map((action, idx) => {
                        const cfg     = STATUS_CONFIG[action.status_detail] || STATUS_CONFIG['Mismatch'];
                        const expanded = expandedRows.has(action.action_id);
                        // Alternating backgrounds
                        const rowBg = idx % 2 === 0 ? 'transparent' : 'var(--color-bg-secondary)';
                        // Hover override
                        const hoverBg = 'rgba(255,255,255,0.04)';

                        return (
                          <>
                            <tr
                              key={action.action_id}
                              style={{ background: selectedActions.has(action.action_id) ? 'rgba(37,99,235,0.1)' : rowBg }}
                              className="transition-colors group"
                              onMouseEnter={(e) => {
                                if (!selectedActions.has(action.action_id)) e.currentTarget.style.background = hoverBg;
                              }}
                              onMouseLeave={(e) => {
                                if (!selectedActions.has(action.action_id)) e.currentTarget.style.background = rowBg;
                              }}
                            >
                              <td className="py-3 px-4">
                                <input
                                  type="checkbox"
                                  checked={selectedActions.has(action.action_id)}
                                  onChange={() => toggleSelect(action.action_id)}
                                  className="rounded border-gray-600 cursor-pointer"
                                  style={{ accentColor: 'var(--color-accent-blue)' }}
                                />
                              </td>
                              <td className="py-3 px-4 text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                {action.source_profile}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{action.component_name}</div>
                                <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{action.component_type}</div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{action.target_profile}</span>
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${cfg.className}`}>
                                    {cfg.label}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => toggleRow(action.action_id)}
                                  className="p-1 rounded transition-colors"
                                  style={{ color: 'var(--color-text-muted)' }}
                                >
                                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded diff row */}
                            {expanded && (
                              <tr key={`${action.action_id}-exp`} style={{ background: 'var(--color-bg-secondary)' }}>
                                <td colSpan={5} className="px-8 py-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    {[
                                      { label: `${sourceEnv} (Source)`,  data: action.source_value,          border: 'border-purple-500/20', header: 'bg-purple-500/10 text-purple-300' },
                                      { label: `${targetEnv} (Target)`,  data: action.current_target_value,  border: 'border-amber-500/20',  header: 'bg-amber-500/10 text-amber-300'   },
                                    ].map(({ label, data, border, header }) => (
                                      <div key={label} className={`border ${border} rounded-lg overflow-hidden`}>
                                        <div className={`${header} px-3 py-1.5 text-xs font-semibold`}>{label}</div>
                                        <pre className="p-3 text-xs text-gray-300 font-mono leading-relaxed overflow-auto max-h-48 bg-transparent">
                                          {data ? JSON.stringify(data, null, 2) : <span className="text-gray-600 italic">— not present —</span>}
                                        </pre>
                                      </div>
                                    ))}
                                  </div>
                                  {action.changes?.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">Changes</p>
                                      <div className="space-y-1">
                                        {action.changes.map((ch, ci) => (
                                          <div key={ci} className="text-xs font-mono flex items-center gap-2">
                                            <span className="text-gray-500">{ch.path}</span>
                                            <span className="text-red-400">{String(ch.old_value)}</span>
                                            <ArrowRight size={10} className="text-gray-600" />
                                            <span className="text-emerald-400">{String(ch.new_value)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════
            SYNC SUCCESS
        ══════════════════════════════════════════════════ */}
        {stage === 4 && syncResult && (
          <motion.div key="sync-done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
            {/* Result hero */}
            <div className="bg-[#1a1b1e] border border-gray-800 rounded-xl shadow-lg p-10 text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 ${
                syncResult.items_failed === 0
                  ? 'bg-emerald-500/10 border-2 border-emerald-500/30'
                  : 'bg-amber-500/10 border-2 border-amber-500/30'
              }`}>
                {syncResult.items_failed === 0
                  ? <CheckCircle2 size={36} className="text-emerald-400" />
                  : <AlertTriangle size={36} className="text-amber-400" />
                }
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {syncResult.items_failed === 0 ? 'Sync Complete' : 'Sync Completed with Errors'}
              </h2>
              <p className="text-gray-400 text-sm max-w-md mx-auto">
                <span className="text-emerald-400 font-semibold">{syncResult.items_synced}</span> permissions synced successfully to <strong className="text-amber-300">{syncResult.target_env}</strong>.
                {syncResult.items_failed > 0 && (
                  <> &nbsp;<span className="text-red-400 font-semibold">{syncResult.items_failed}</span> failed.</>
                )}
              </p>

              {/* Stats row */}
              <div className="flex items-center justify-center gap-6 mt-6">
                {[
                  { label: 'Synced',    value: syncResult.items_synced, color: 'text-emerald-400' },
                  { label: 'Failed',    value: syncResult.items_failed, color: 'text-red-400'     },
                  { label: 'Sync ID',   value: syncResult.sync_id,      color: 'text-gray-400'    },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <div className={`text-xl font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-gray-600">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Failed Actions Details */}
            {syncResult.details && syncResult.details.some(d => d.sync_status === 'Failed') && (
              <div className="bg-[#1a1b1e] border border-red-900/30 rounded-xl overflow-hidden shadow-lg">
                <div className="px-5 py-3.5 border-b border-red-900/50 bg-red-500/5 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-400" />
                  <h3 className="text-sm font-semibold text-red-200">Failed Sync Actions</h3>
                </div>
                <div className="p-0">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#0f1115]">
                      <tr>
                        <th className="px-4 py-2 text-xs font-semibold text-gray-400 border-b border-gray-800">Profile</th>
                        <th className="px-4 py-2 text-xs font-semibold text-gray-400 border-b border-gray-800">Component</th>
                        <th className="px-4 py-2 text-xs font-semibold text-gray-400 border-b border-gray-800">Error Detail</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {syncResult.details.filter(d => d.sync_status === 'Failed').map((d, i) => (
                        <tr key={i} className="hover:bg-red-500/5 transition-colors">
                          <td className="px-4 py-3 text-xs text-gray-300 font-medium">
                            {d.target_profile || d.profile || 'Unknown Profile'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                            {d.component_name || 'Unknown Component'}
                          </td>
                          <td className="px-4 py-3 text-xs text-red-300 font-mono break-words whitespace-pre-wrap max-w-md">
                            {d.error || 'Unknown Error'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Deployment XML artifacts */}
            {syncResult.deployment_artifacts && Object.keys(syncResult.deployment_artifacts).length > 0 && (
              <div className="bg-[#1a1b1e] border border-gray-800 rounded-xl overflow-hidden shadow-lg">
                <div className="px-5 py-3.5 border-b border-gray-800 bg-gray-800/20">
                  <h3 className="text-sm font-semibold text-gray-300">Generated Metadata XML</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Reference XML for manual Salesforce deployment</p>
                </div>
                <div className="p-5 space-y-4">
                  {Object.entries(syncResult.deployment_artifacts).map(([profile, xml]) => (
                    <div key={profile} className="border border-gray-800 rounded-lg overflow-hidden">
                      <div className="bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 border-b border-gray-700 font-mono">
                        {profile}.profile-meta.xml
                      </div>
                      <pre className="p-4 text-xs text-blue-300 bg-[#0d0d0f] overflow-x-auto m-0 leading-relaxed font-mono max-h-60">
                        {xml}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-center gap-4">
              <Btn variant="outline" onClick={() => { setSyncResult(null); }}>
                <ArrowLeft size={15} /> Back to Results
              </Btn>
              <Btn variant="primary" onClick={reset}>
                <RefreshCw size={15} /> Start New Comparison
              </Btn>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
