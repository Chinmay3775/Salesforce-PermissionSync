/**
 * DriftAnalysis — Drift detection dashboard with severity breakdown.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, TrendingUp, Activity, ArrowRight, AlertCircle, BarChart3, Filter } from 'lucide-react';
import StatusBadge, { DriftSummaryCard } from '../components/StatusBadge';

const anim = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const ai = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };
const ec = { DEV: 'var(--color-env-dev)', UAT: 'var(--color-env-uat)', PROD: 'var(--color-env-prod)' };

export default function DriftAnalysis() {
  const [sevFilter, setSevFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');

  const driftItems = []; // Replaced mock data with empty state

  const filtered = driftItems.filter(d => (sevFilter === 'all' || d.severity === sevFilter) && (catFilter === 'all' || d.category === catFilter));
  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };

  return (
    <motion.div variants={anim} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={ai}>
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-text-primary)' }}>Drift Analysis</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Detect and classify permission drift across environments</p>
      </motion.div>

      <motion.div variants={ai} className="grid grid-cols-5 gap-4">
        <DriftSummaryCard title="Total Drifts" value={driftItems.length} severity="info" icon={BarChart3} />
        <DriftSummaryCard title="Critical" value={counts.Critical} severity="Critical" icon={AlertTriangle} trend={12} />
        <DriftSummaryCard title="High" value={counts.High} severity="High" icon={Shield} />
        <DriftSummaryCard title="Medium" value={counts.Medium} severity="Medium" icon={Activity} trend={-5} />
        <DriftSummaryCard title="Low" value={counts.Low} severity="Low" icon={TrendingUp} trend={-8} />
      </motion.div>

      {/* Critical Alerts */}
      {counts.Critical > 0 && (
        <motion.div variants={ai} className="p-4 rounded-lg" style={{ background: 'var(--color-severity-critical)08', border: '1px solid var(--color-severity-critical)30' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={16} style={{ color: 'var(--color-severity-critical)' }} />
            <span className="text-sm font-bold" style={{ color: 'var(--color-severity-critical)' }}>Critical Drift Alerts</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {driftItems.filter(d=>d.severity==='Critical').map(d => (
              <div key={d.id} className="p-3 rounded-lg" style={{ background:'var(--color-bg-card)', border:'1px solid var(--color-severity-critical)20' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold font-mono" style={{ color:'var(--color-text-primary)' }}>{d.item}</span>
                  <StatusBadge label="Critical" size="xs" />
                </div>
                <p className="text-[10px] leading-relaxed" style={{ color:'var(--color-text-tertiary)' }}>{d.description}</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-[9px] font-bold px-1.5 rounded" style={{ background:`${ec[d.source_env]}20`, color:ec[d.source_env] }}>{d.source_env}</span>
                  <ArrowRight size={10} style={{ color:'var(--color-text-muted)' }} />
                  <span className="text-[9px] font-bold px-1.5 rounded" style={{ background:`${ec[d.target_env]}20`, color:ec[d.target_env] }}>{d.target_env}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Consistency Scores */}
      <motion.div variants={ai} className="grid grid-cols-3 gap-4">
        {/* Placeholder for real consistency scores */}
        <div className="col-span-3 text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
          Run a comparison to view environment consistency scores.
        </div>
      </motion.div>

      {/* Filters + Table */}
      <motion.div variants={ai} className="flex items-center gap-3">
        <Filter size={14} style={{ color:'var(--color-text-muted)' }} />
        <select value={sevFilter} onChange={e=>setSevFilter(e.target.value)} className="px-3 py-2 rounded-lg text-xs cursor-pointer" style={{ background:'var(--color-bg-card)', color:'var(--color-text-secondary)', border:'1px solid var(--color-border-primary)' }}>
          <option value="all">All Severities</option>
          {['Critical','High','Medium','Low'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} className="px-3 py-2 rounded-lg text-xs cursor-pointer" style={{ background:'var(--color-bg-card)', color:'var(--color-text-secondary)', border:'1px solid var(--color-border-primary)' }}>
          <option value="all">All Categories</option>
          {['Field Permission','Object Permission','Apex Class Access','Tab Visibility','User Permission'].map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <span className="text-[11px] ml-auto" style={{ color:'var(--color-text-muted)' }}>{filtered.length} items</span>
      </motion.div>

      <motion.div variants={ai} className="glass-card overflow-hidden">
        <table className="w-full text-xs">
          <thead style={{ background:'var(--color-bg-tertiary)' }}>
            <tr style={{ borderBottom:'1px solid var(--color-border-primary)' }}>
              {['Severity','Category','Item','Profile','Environments','Description'].map(h=>(
                <th key={h} className="text-left p-3 font-semibold uppercase tracking-wider" style={{ color:'var(--color-text-tertiary)', fontSize:'10px' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map(d=>(
                <tr key={d.id} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ borderBottom:'1px solid var(--color-border-primary)' }}>
                  <td className="p-3"><StatusBadge label={d.severity} size="xs" /></td>
                  <td className="p-3" style={{ color:'var(--color-text-secondary)' }}>{d.category}</td>
                  <td className="p-3 font-mono font-medium" style={{ color:'var(--color-text-primary)' }}>{d.item}</td>
                  <td className="p-3" style={{ color:'var(--color-text-secondary)' }}>{d.profile}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold px-1.5 rounded" style={{ background:`${ec[d.source_env]}20`, color:ec[d.source_env] }}>{d.source_env}</span>
                      <ArrowRight size={8} style={{ color:'var(--color-text-muted)' }} />
                      <span className="text-[9px] font-bold px-1.5 rounded" style={{ background:`${ec[d.target_env]}20`, color:ec[d.target_env] }}>{d.target_env}</span>
                    </div>
                  </td>
                  <td className="p-3 max-w-[300px] truncate" style={{ color:'var(--color-text-tertiary)' }}>{d.description}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center py-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>No drift detected.</td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>
    </motion.div>
  );
}
