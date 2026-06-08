/**
 * Reports — Report generation and download center.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileBarChart, Download, FileSpreadsheet, FileText, FileJson, Clock, Trash2, Loader2, Plus } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const ai = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const mockReports = []; // Removed mock data

const formatIcons = { excel: FileSpreadsheet, csv: FileText, json: FileJson, pdf: FileBarChart };
const ec = { DEV:'var(--color-env-dev)', UAT:'var(--color-env-uat)', PROD:'var(--color-env-prod)' };

export default function Reports() {
  const [reportType, setReportType] = useState('comparison');
  const [format, setFormat] = useState('excel');
  const [sourceEnv, setSourceEnv] = useState('DEV');
  const [targetEnv, setTargetEnv] = useState('PROD');
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 2000));
    setGenerating(false);
  };

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" style={{ color:'var(--color-text-primary)' }}>Reports</h2>
        <p className="text-sm mt-1" style={{ color:'var(--color-text-secondary)' }}>Generate, download, and manage comparison reports</p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Report Generator */}
        <div className="glass-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color:'var(--color-text-tertiary)' }}>
            <Plus size={12} className="inline mr-1" /> Generate New Report
          </h3>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color:'var(--color-text-muted)' }}>Report Type</label>
              <select value={reportType} onChange={e=>setReportType(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs cursor-pointer" style={{ background:'var(--color-bg-input)', color:'var(--color-text-secondary)', border:'1px solid var(--color-border-primary)' }}>
                <option value="comparison">Comparison Report</option>
                <option value="drift">Drift Analysis</option>
                <option value="audit">Audit Report</option>
                <option value="sync_history">Sync History</option>
                <option value="full">Full Report</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color:'var(--color-text-muted)' }}>Format</label>
              <div className="grid grid-cols-3 gap-2">
                {['excel','csv','json'].map(f => {
                  const Icon = formatIcons[f];
                  return (
                    <button key={f} onClick={()=>setFormat(f)} className="flex flex-col items-center gap-1 p-3 rounded-lg text-[10px] font-medium cursor-pointer transition-all"
                      style={{ background: format===f ? 'var(--color-accent-blue)12' : 'var(--color-bg-secondary)', color: format===f ? 'var(--color-accent-blue)' : 'var(--color-text-muted)', border:`1px solid ${format===f ? 'var(--color-accent-blue)30' : 'var(--color-border-primary)'}` }}>
                      <Icon size={16} />
                      {f.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color:'var(--color-text-muted)' }}>Source</label>
                <select value={sourceEnv} onChange={e=>setSourceEnv(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs cursor-pointer" style={{ background:'var(--color-bg-input)', color:ec[sourceEnv], border:'1px solid var(--color-border-primary)' }}>
                  {['DEV','UAT','PROD'].map(e=><option key={e} value={e} className="bg-white dark:bg-[#1a2035] text-black dark:text-white">{e}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider mb-1 block" style={{ color:'var(--color-text-muted)' }}>Target</label>
                <select value={targetEnv} onChange={e=>setTargetEnv(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs cursor-pointer" style={{ background:'var(--color-bg-input)', color:ec[targetEnv], border:'1px solid var(--color-border-primary)' }}>
                  {['DEV','UAT','PROD'].map(e=><option key={e} value={e} className="bg-white dark:bg-[#1a2035] text-black dark:text-white">{e}</option>)}
                </select>
              </div>
            </div>

            <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.99 }} onClick={handleGenerate} disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold cursor-pointer disabled:opacity-50"
              style={{ background:'var(--gradient-primary)', color:'#fff' }}>
              {generating ? <Loader2 size={16} className="animate-spin" /> : <FileBarChart size={16} />}
              {generating ? 'Generating...' : 'Generate Report'}
            </motion.button>
          </div>
        </div>

        {/* Reports List */}
        <div className="col-span-2 glass-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color:'var(--color-text-tertiary)' }}>
            Generated Reports
          </h3>
          <div className="space-y-3">
            {mockReports.length > 0 ? (
              mockReports.map(r => {
                const Icon = formatIcons[r.format] || FileText;
                return (
                  <motion.div key={r.id} whileHover={{ x:3 }} className="flex items-center gap-4 p-4 rounded-lg transition-colors"
                    style={{ background:'var(--color-bg-secondary)', border:'1px solid var(--color-border-primary)' }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background:'var(--color-accent-blue)12' }}>
                      <Icon size={18} style={{ color:'var(--color-accent-blue)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color:'var(--color-text-primary)' }}>{r.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px]" style={{ color:'var(--color-text-muted)' }}>{r.format.toUpperCase()}</span>
                        <span className="text-[10px]" style={{ color:'var(--color-text-muted)' }}>{r.size}</span>
                        <span className="text-[10px]" style={{ color:'var(--color-text-muted)' }}>{r.rows} rows</span>
                        <div className="flex gap-1">
                          {r.envs.map(e => <span key={e} className="text-[8px] font-bold px-1 rounded" style={{ background:`${ec[e]}20`, color:ec[e] }}>{e}</span>)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] flex items-center gap-1" style={{ color:'var(--color-text-muted)' }}>
                        <Clock size={10} /> {r.date}
                      </span>
                      <button className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer" style={{ color:'var(--color-accent-blue)' }}>
                        <Download size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-10 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                No reports generated yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
