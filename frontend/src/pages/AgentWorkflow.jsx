import { useState } from 'react';
import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Play, CheckCircle2, AlertTriangle, Plus, Trash2, ArrowRight, Upload } from 'lucide-react';
import { runAgent, approveAgentActions } from '../services/api';
import * as XLSX from 'xlsx';

export default function AgentWorkflow() {
  const [sourceEnv, setSourceEnv] = useState('DEV');
  const [targetEnv, setTargetEnv] = useState('UAT');
  const [components, setComponents] = useState([{ type: 'ApexClass', name: '', objectName: '' }]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [stage, setStage] = useState(1); // 1: Setup, 2: Review, 3: Success
  const [actionPlan, setActionPlan] = useState([]);
  const [selectedActions, setSelectedActions] = useState(new Set());
  
  const [deploymentResult, setDeploymentResult] = useState(null);
  
  const fileInputRef = useRef(null);

  // Handlers for dynamic table
  const addComponent = () => {
    setComponents([...components, { type: 'ApexClass', name: '', objectName: '' }]);
  };
  
  const removeComponent = (index) => {
    if (components.length === 1) return;
    const newComp = [...components];
    newComp.splice(index, 1);
    setComponents(newComp);
  };
  
  const updateComponent = (index, field, value) => {
    const newComp = [...components];
    newComp[index][field] = value;
    setComponents(newComp);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        let newComponents = [];

        const normalizeKey = (k) => String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
        
        const extractType = (item) => {
          let rawType = 'ApexClass';
          const priorities = ['componenttype', 'type'];
          
          for (const p of priorities) {
            for (const [k, v] of Object.entries(item)) {
              if (normalizeKey(k) === p && v) {
                rawType = String(v).trim();
                break;
              }
            }
            if (rawType !== 'ApexClass') break;
          }
          
          const normType = rawType.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normType === 'customobject') return 'CustomObject';
          if (normType === 'customfield') return 'CustomField';
          if (normType === 'apexclass') return 'ApexClass';
          
          return rawType;
        };
        
        const extractObjectName = (item) => {
          const priorities = ['objectname', 'object', 'sobject', 'parentobject'];
          for (const p of priorities) {
            for (const [k, v] of Object.entries(item)) {
              if (normalizeKey(k) === p && v) {
                return String(v).trim();
              }
            }
          }
          return '';
        };
        
        const extractName = (item) => {
          // Prioritize API Name columns over human-readable labels
          const priorities = ['componentapiname', 'apiname', 'developername', 'name', 'componentname'];
          
          for (const p of priorities) {
            for (const [k, v] of Object.entries(item)) {
              if (normalizeKey(k) === p && v) {
                return String(v).trim();
              }
            }
          }
          return '';
        };

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const parsed = XLSX.utils.sheet_to_json(worksheet);
          
          if (Array.isArray(parsed)) {
             newComponents = parsed.map(item => ({
               type: extractType(item),
               name: extractName(item),
               objectName: extractObjectName(item)
             })).filter(c => c.type && c.name);
          }
        } else {
          const content = event.target.result;
          if (file.name.endsWith('.json')) {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
               newComponents = parsed.map(item => ({
                 type: extractType(item),
                 name: extractName(item),
                 objectName: extractObjectName(item)
               })).filter(c => c.type && c.name);
            }
          } else if (file.name.endsWith('.csv')) {
            const lines = content.split(/\r?\n/);
            lines.forEach((line, idx) => {
               const parts = line.split(',');
               if (parts.length >= 2) {
                 const type = parts[0].trim();
                 const name = parts[1].trim();
                 if (idx === 0 && type.toLowerCase().includes('type') && name.toLowerCase().includes('name')) return;
                 if (type && name) {
                   newComponents.push({ type, name });
                 }
               }
            });
          }
        }

        if (newComponents.length > 0) {
           const currentComponents = components.length === 1 && components[0].name === '' 
             ? [] 
             : components;
           setComponents([...currentComponents, ...newComponents]);
        } else {
           setError('Could not find any valid components in the uploaded file.');
        }
      } catch (err) {
        setError('Error parsing file: ' + err.message);
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleRunAgent = async () => {
    // filter empty
    const validComponents = components
      .filter(c => c.name.trim() !== '')
      .map(c => ({
        type: c.type,
        name: c.type === 'CustomField' ? `${c.objectName}.${c.name}` : c.name
      }));
      
    if (validComponents.length === 0) {
      setError('Please add at least one valid component.');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const payload = {
        source_env: sourceEnv,
        target_env: targetEnv,
        deployment_sheet: validComponents
      };
      const res = await runAgent(payload);
      
      setActionPlan(res.data.action_plan || []);
      // Select all by default
      const allIds = new Set((res.data.action_plan || []).map(a => a.action_id));
      setSelectedActions(allIds);
      
      setStage(2);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to run agent');
    } finally {
      setLoading(false);
    }
  };

  const toggleActionSelection = (id) => {
    const newSel = new Set(selectedActions);
    if (newSel.has(id)) {
      newSel.delete(id);
    } else {
      newSel.add(id);
    }
    setSelectedActions(newSel);
  };

  const handleApprove = async () => {
    if (selectedActions.size === 0) {
      setError('Please select at least one action to approve.');
      return;
    }
    
    const approved = actionPlan.filter(a => selectedActions.has(a.action_id));
    
    setLoading(true);
    setError('');
    
    try {
      const payload = {
        target_env: targetEnv,
        approved_actions: approved
      };
      const res = await approveAgentActions(payload);
      
      setDeploymentResult(res.data);
      setStage(3);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to process approvals');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStage(1);
    setActionPlan([]);
    setDeploymentResult(null);
    setComponents([{ type: 'ApexClass', name: '', objectName: '' }]);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2 text-white">
            <Bot className="text-blue-400" />
            Deployment-Based Permission Agent
          </h1>
          <p className="text-sm text-gray-400">
            Intelligently fetch, compare, and deploy permissions for specific components.
          </p>
        </div>
        
        {stage > 1 && (
          <button 
            onClick={reset}
            className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700"
          >
            Start New Run
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
          <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
          <p className="text-sm text-red-200">{error}</p>
        </div>
      )}

      {/* STAGE 1: SETUP */}
      {stage === 1 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-[#1a1b1e] border border-gray-800 rounded-xl shadow-lg overflow-hidden"
        >
          <div className="p-5 border-b border-gray-800 bg-gray-800/20">
            <h2 className="font-semibold text-white">Agent Setup</h2>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Source Environment</label>
                <select 
                  className="w-full bg-[#141517] border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  value={sourceEnv} onChange={e => setSourceEnv(e.target.value)}
                >
                  <option value="DEV">DEV</option>
                  <option value="UAT">UAT</option>
                  <option value="PROD">PROD</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Target Environment</label>
                <select 
                  className="w-full bg-[#141517] border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  value={targetEnv} onChange={e => setTargetEnv(e.target.value)}
                >
                  <option value="UAT">UAT</option>
                  <option value="DEV">DEV</option>
                  <option value="PROD">PROD</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Deployment Sheet Components</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="file" 
                    accept=".csv,.json,.xlsx,.xls" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 font-medium"
                  >
                    <Upload size={14} /> Upload Sheet
                  </button>
                  <button 
                    onClick={addComponent}
                    className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium"
                  >
                    <Plus size={14} /> Add Row
                  </button>
                </div>
              </div>
              
              <div className="border border-gray-800 rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-800/40 text-xs text-gray-400 uppercase">
                      <th className="py-2.5 px-4 font-medium border-b border-gray-800 w-1/4">Component Type</th>
                      <th className="py-2.5 px-4 font-medium border-b border-gray-800 w-1/4">Object Name</th>
                      <th className="py-2.5 px-4 font-medium border-b border-gray-800 w-1/3">API Name</th>
                      <th className="py-2.5 px-4 font-medium border-b border-gray-800 w-16 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((c, i) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        <td className="p-2">
                          <select 
                            className="w-full bg-transparent border-none text-sm text-gray-200 focus:ring-0 outline-none cursor-pointer"
                            value={c.type} onChange={e => updateComponent(i, 'type', e.target.value)}
                          >
                            <option className="bg-gray-900" value="ApexClass">ApexClass</option>
                            <option className="bg-gray-900" value="CustomField">CustomField</option>
                            <option className="bg-gray-900" value="CustomObject">CustomObject</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input 
                            type="text"
                            placeholder={c.type === 'CustomField' ? "e.g. Account" : "-"}
                            className="w-full bg-transparent border-none text-sm text-white focus:ring-0 outline-none"
                            value={c.objectName} 
                            onChange={e => updateComponent(i, 'objectName', e.target.value)}
                            disabled={c.type !== 'CustomField'}
                            style={{ opacity: c.type === 'CustomField' ? 1 : 0.3 }}
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text"
                            placeholder={c.type === 'CustomField' ? "e.g. Status__c" : "e.g. EmailController"}
                            className="w-full bg-transparent border-none text-sm text-white focus:ring-0 outline-none"
                            value={c.name} onChange={e => updateComponent(i, 'name', e.target.value)}
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button 
                            onClick={() => removeComponent(i)}
                            className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            disabled={components.length === 1}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          <div className="p-5 bg-gray-900 border-t border-gray-800 flex justify-end">
            <button
              onClick={handleRunAgent}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play size={16} className="fill-current" />
              )}
              {loading ? 'Agent Running...' : 'Run Agent Engine'}
            </button>
          </div>
        </motion.div>
      )}

      {/* STAGE 2: ACTION PLAN */}
      {stage === 2 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-[#1a1b1e] border border-gray-800 rounded-xl shadow-lg overflow-hidden"
        >
          <div className="p-5 border-b border-gray-800 bg-gray-800/20 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white flex items-center gap-2">
                <CheckCircle2 className="text-green-400" size={18} />
                Generated Action Plan
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Select the actions you wish to approve for deployment to {targetEnv}.</p>
            </div>
            <div className="text-sm font-medium text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
              {selectedActions.size} / {actionPlan.length} Selected
            </div>
          </div>
          
          <div className="p-0 overflow-x-auto">
            {actionPlan.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">
                No differences found for the specified components. Environments are perfectly synced.
              </div>
            ) : (
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr className="bg-[#141517] text-xs text-gray-400 uppercase tracking-wider">
                    <th className="py-3 px-4 font-medium border-b border-gray-800 w-10 text-center">
                      <input 
                        type="checkbox" 
                        className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/50"
                        checked={selectedActions.size === actionPlan.length && actionPlan.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedActions(new Set(actionPlan.map(a => a.action_id)));
                          } else {
                            setSelectedActions(new Set());
                          }
                        }}
                      />
                    </th>
                    <th className="py-3 px-4 font-medium border-b border-gray-800">Profile</th>
                    <th className="py-3 px-4 font-medium border-b border-gray-800">Component</th>
                    <th className="py-3 px-4 font-medium border-b border-gray-800">Action</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-800/50">
                  {actionPlan.map((action) => (
                    <tr 
                      key={action.action_id} 
                      className={`hover:bg-gray-800/30 transition-colors cursor-pointer ${selectedActions.has(action.action_id) ? 'bg-blue-500/5' : ''}`}
                      onClick={() => toggleActionSelection(action.action_id)}
                    >
                      <td className="py-3 px-4 text-center">
                        <input 
                          type="checkbox"
                          className="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500/50 cursor-pointer pointer-events-none"
                          checked={selectedActions.has(action.action_id)}
                          readOnly
                        />
                      </td>
                      <td className="py-3 px-4 text-gray-300 font-medium">
                        {action.profile}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="text-gray-200">{action.component_name}</span>
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">{action.component_type}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                          action.action === 'Add' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                          'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        }`}>
                          {action.action}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          
          <div className="p-5 bg-gray-900 border-t border-gray-800 flex justify-end gap-3">
            <button
              onClick={reset}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={loading || selectedActions.size === 0 || actionPlan.length === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg shadow-lg shadow-green-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <ArrowRight size={16} />
              )}
              {loading ? 'Deploying...' : `Approve & Deploy (${selectedActions.size})`}
            </button>
          </div>
        </motion.div>
      )}

      {/* STAGE 3: SUCCESS */}
      {stage === 3 && deploymentResult && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-[#1a1b1e] border border-gray-800 rounded-xl shadow-lg overflow-hidden"
        >
          <div className="p-8 text-center border-b border-gray-800">
            <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Deployment Successful</h2>
            <p className="text-gray-400 text-sm max-w-md mx-auto">
              Successfully deployed {deploymentResult.items_synced} permissions to {deploymentResult.target_env}.
              {deploymentResult.items_failed > 0 && ` Failed to deploy ${deploymentResult.items_failed} items.`}
            </p>
          </div>
          
          {/* Display generated XML artifacts */}
          {deploymentResult.deployment_artifacts && Object.keys(deploymentResult.deployment_artifacts).length > 0 && (
            <div className="p-6 bg-[#141517]">
              <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider mb-4">Generated Metadata API XML</h3>
              <div className="space-y-4">
                {Object.entries(deploymentResult.deployment_artifacts).map(([profile, xml]) => (
                  <div key={profile} className="border border-gray-800 rounded-lg overflow-hidden">
                    <div className="bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 border-b border-gray-700">
                      {profile}.profile-meta.xml
                    </div>
                    <pre className="p-4 text-xs text-blue-300 bg-[#0d0d0f] overflow-x-auto m-0 leading-relaxed font-mono">
                      {xml}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="p-5 bg-gray-900 border-t border-gray-800 flex justify-center">
            <button
              onClick={reset}
              className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg border border-gray-700 transition-colors"
            >
              Start New Workflow
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
