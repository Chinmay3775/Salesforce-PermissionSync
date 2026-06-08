/**
 * Comparison — Git-style diff viewer with side-by-side comparison.
 */
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  GitCompareArrows, ArrowRight, Filter, Search,
  ChevronDown, ChevronRight as ChevronR, Eye,
  AlertTriangle, CheckCircle2, XCircle, Minus
} from 'lucide-react';
import { useComparisonStore } from '../store';
import StatusBadge from '../components/StatusBadge';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const envColors = { DEV: 'var(--color-env-dev)', UAT: 'var(--color-env-uat)', PROD: 'var(--color-env-prod)' };

export default function Comparison() {
  const [sourceEnv, setSourceEnv] = useState('DEV');
  const [targetEnv, setTargetEnv] = useState('UAT');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');

  const results = useComparisonStore((s) => s.results);
  const loading = useComparisonStore((s) => s.loading);
  const compare = useComparisonStore((s) => s.compare);

  const data = results || { summary: {}, details: [] };
  const summary = data.summary || {};

  const filteredDetails = useMemo(() => {
    let items = data.details || [];
    if (search) items = items.filter((d) => d.item?.toLowerCase().includes(search.toLowerCase()) || d.profile?.toLowerCase().includes(search.toLowerCase()));
    if (categoryFilter !== 'all') items = items.filter((d) => d.category === categoryFilter);
    if (severityFilter !== 'all') items = items.filter((d) => d.severity === severityFilter);
    return items;
  }, [data.details, search, categoryFilter, severityFilter]);

  const categories = [...new Set((data.details || []).map((d) => d.category))];

  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCompare = () => {
    compare(sourceEnv, targetEnv);
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Comparison</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Side-by-side metadata diff analysis</p>
        </div>
      </motion.div>

      {/* Env Selectors + Compare Button */}
      <motion.div variants={item} className="flex items-center gap-3">
        <EnvSelector label="Source" value={sourceEnv} onChange={setSourceEnv} />
        <div className="flex items-center gap-1 px-3" style={{ color: 'var(--color-text-muted)' }}>
          <ArrowRight size={20} />
        </div>
        <EnvSelector label="Target" value={targetEnv} onChange={setTargetEnv} />
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleCompare}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold ml-auto cursor-pointer"
          style={{ background: 'var(--gradient-primary)', color: '#fff' }}>
          {loading ? <span className="animate-spin">⏳</span> : <GitCompareArrows size={16} />}
          {loading ? 'Comparing...' : 'Compare'}
        </motion.button>
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={item} className="grid grid-cols-6 gap-3">
        {[
          { label: 'Total', value: summary.total_compared, color: 'var(--color-accent-blue)' },
          { label: 'Matches', value: summary.matches, color: 'var(--color-status-success)' },
          { label: 'Mismatches', value: summary.mismatches, color: 'var(--color-diff-changed)' },
          { label: 'Critical', value: summary.critical_drifts, color: 'var(--color-severity-critical)' },
          { label: 'High', value: summary.high_drifts, color: 'var(--color-severity-high)' },
          { label: 'Medium+Low', value: (summary.medium_drifts || 0) + (summary.low_drifts || 0), color: 'var(--color-severity-medium)' },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value || 0}</p>
          </div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-primary)' }}>
          <Search size={14} style={{ color: 'var(--color-text-muted)' }} />
          <input type="text" placeholder="Search fields, profiles..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none" style={{ color: 'var(--color-text-primary)' }} />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs cursor-pointer" style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-primary)' }}>
          <option value="all">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-xs cursor-pointer" style={{ background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-primary)' }}>
          <option value="all">All Severities</option>
          {['Critical', 'High', 'Medium', 'Low'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-[11px] px-3" style={{ color: 'var(--color-text-muted)' }}>{filteredDetails.length} results</span>
      </motion.div>

      {/* Diff Table */}
      <motion.div variants={item} className="glass-card overflow-hidden">
        <div className="overflow-x-auto" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10" style={{ background: 'var(--color-bg-tertiary)' }}>
              <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
                <th className="w-8 p-3"></th>
                <th className="text-left p-3 font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)', fontSize: '10px' }}>Category</th>
                <th className="text-left p-3 font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)', fontSize: '10px' }}>Item</th>
                <th className="text-left p-3 font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)', fontSize: '10px' }}>Profile</th>
                <th className="text-left p-3 font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)', fontSize: '10px' }}>Status</th>
                <th className="text-left p-3 font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-tertiary)', fontSize: '10px' }}>Severity</th>
                <th className="text-left p-3 font-semibold uppercase tracking-wider" style={{ color: envColors[sourceEnv], fontSize: '10px' }}>{sourceEnv}</th>
                <th className="text-left p-3 font-semibold uppercase tracking-wider" style={{ color: envColors[targetEnv], fontSize: '10px' }}>{targetEnv}</th>
              </tr>
            </thead>
            <tbody>
              {filteredDetails.length > 0 ? (
                filteredDetails.map((d) => (
                  <DiffRow key={d.id} data={d} expanded={expandedRows.has(d.id)} onToggle={() => toggleRow(d.id)} sourceEnv={sourceEnv} targetEnv={targetEnv} />
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="text-center py-10 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {results ? "No differences found or no items match your filters." : "Run a comparison to see metadata differences."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DiffRow({ data, expanded, onToggle, sourceEnv, targetEnv }) {
  const statusColors = {
    Mismatch: 'var(--color-diff-changed)',
    'Missing in Source': 'var(--color-diff-removed)',
    'Missing in Target': 'var(--color-diff-removed)',
    Match: 'var(--color-diff-match)',
  };

  const rowBg = data.status === 'Mismatch' ? 'var(--color-diff-changed-bg)' : data.status.includes('Missing') ? 'var(--color-diff-removed-bg)' : 'transparent';

  const formatValue = (obj) => {
    if (!obj) return '—';
    const keys = Object.keys(obj).filter((k) => !['field', 'object_name', 'apexClass', 'tab', 'name'].includes(k));
    return keys.map((k) => `${k}: ${obj[k]}`).join(', ');
  };

  return (
    <>
      <tr onClick={onToggle} className="cursor-pointer transition-colors hover:bg-white/[0.03]" style={{ background: rowBg, borderBottom: '1px solid var(--color-border-primary)' }}>
        <td className="p-3 text-center">
          {expanded ? <ChevronDown size={12} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronR size={12} style={{ color: 'var(--color-text-muted)' }} />}
        </td>
        <td className="p-3" style={{ color: 'var(--color-text-secondary)' }}>{data.category}</td>
        <td className="p-3 font-mono font-medium" style={{ color: 'var(--color-text-primary)' }}>{data.item}</td>
        <td className="p-3" style={{ color: 'var(--color-text-secondary)' }}>{data.profile}</td>
        <td className="p-3"><StatusBadge label={data.status} size="xs" /></td>
        <td className="p-3"><StatusBadge label={data.severity} size="xs" /></td>
        <td className="p-3 font-mono text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{formatValue(data.source)}</td>
        <td className="p-3 font-mono text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>{formatValue(data.target)}</td>
      </tr>
      {expanded && (
        <tr style={{ background: 'var(--color-bg-input)' }}>
          <td colSpan={8} className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <DiffPanel title={sourceEnv} data={data.source} color={envColors[sourceEnv]} />
              <DiffPanel title={targetEnv} data={data.target} color={envColors[targetEnv]} />
            </div>
            {data.changes?.length > 0 && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-primary)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-diff-changed)' }}>Changes</p>
                {data.changes.map((c, i) => (
                  <div key={i} className="text-[11px] font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>{c.path}:</span>
                    {c.old_value !== undefined && <span style={{ color: 'var(--color-diff-removed)' }}> -{String(c.old_value)}</span>}
                    {c.new_value !== undefined && <span style={{ color: 'var(--color-diff-added)' }}> +{String(c.new_value)}</span>}
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function DiffPanel({ title, data, color }) {
  if (!data) return <div className="p-3 rounded-lg text-center" style={{ background: 'var(--color-diff-removed-bg)', border: '1px solid var(--color-diff-removed)30' }}>
    <p className="text-xs" style={{ color: 'var(--color-diff-removed)' }}>Not found in {title}</p>
  </div>;

  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--color-bg-secondary)', border: `1px solid ${color}30` }}>
      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color }}>{title}</p>
      <div className="space-y-1 font-mono text-[11px]">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span style={{ color: 'var(--color-text-muted)' }}>{k}</span>
            <span style={{ color: typeof v === 'boolean' ? (v ? 'var(--color-diff-added)' : 'var(--color-diff-removed)') : 'var(--color-text-primary)' }}>
              {String(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EnvSelector({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border-primary)' }}>
      <span className="text-[10px] font-medium uppercase" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm font-bold outline-none cursor-pointer" style={{ color: envColors[value] }}>
        {['DEV', 'UAT', 'PROD'].map((e) => <option key={e} value={e} className="bg-white dark:bg-[#1a2035] text-black dark:text-white">{e}</option>)}
      </select>
    </div>
  );
}
