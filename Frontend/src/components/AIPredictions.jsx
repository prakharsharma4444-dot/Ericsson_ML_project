import { useState } from 'react';
import { BrainCircuit, ChevronDown, ChevronUp, BarChart3, Loader2, SlidersHorizontal } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { compareColumns } from '../api';

function AIPredictions({ sessionId, columns = [], onSelectTarget }) {
  const colNames = columns.map((c) => (typeof c === 'object' ? c.name : c));
  const [target, setTarget] = useState('');
  const [xCol, setXCol] = useState(colNames[0] || '');
  const [yCol, setYCol] = useState(colNames[1] || colNames[0] || '');
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const train = async () => {
    if (!target || !onSelectTarget || loading) return;
    setLoading(true);
    try { await onSelectTarget(target); } finally { setLoading(false); }
  };

  const compare = async () => {
    if (!sessionId || !xCol || !yCol) return;
    setComparisonError('');
    try { setComparison(await compareColumns(sessionId, xCol, yCol)); }
    catch (err) { setComparisonError(err.message || 'Unable to compare the selected columns.'); }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <p className="text-xs uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400">Model Studio</p>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">Train & Compare</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Select a target column and let the ML pipeline determine the problem type, preprocess the data, compare candidate models, and prepare a prediction workflow.
        </p>
      </div>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center"><BrainCircuit size={19} /></div>
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Choose a prediction target</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Classification and regression are inferred from the selected target.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Target column</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={loading} className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">Select a target…</option>
              {colNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <button type="button" onClick={train} disabled={!target || loading} className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? 'Running ML pipeline…' : 'Train & Compare'}
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20 p-4">
          <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-200">What happens after you start?</p>
          <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 mt-1.5 leading-5">
            The backend validates the target, cleans the data, creates useful features, selects informative inputs, trains several models, performs cross-validation, compares metrics, and recommends a model.
          </p>
        </div>

        <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button type="button" onClick={() => setAdvancedOpen((open) => !open)} className="w-full flex items-center justify-between text-left text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
            <span className="flex items-center gap-2"><SlidersHorizontal size={14} />Advanced target selection</span>
            {advancedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {advancedOpen && <div className="mt-4 flex flex-wrap gap-2">{colNames.map((name) => <button type="button" key={name} onClick={() => setTarget(name)} className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600">{name}</button>)}</div>}
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <BarChart3 size={19} className="text-indigo-600 dark:text-indigo-400 mt-0.5" />
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Column Relationship Explorer</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Compare two columns before deciding what to model.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label><span className="text-xs font-medium text-slate-500">Column A</span><select value={xCol} onChange={(e) => setXCol(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm">{colNames.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label><span className="text-xs font-medium text-slate-500">Column B</span><select value={yCol} onChange={(e) => setYCol(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm">{colNames.map((c) => <option key={c}>{c}</option>)}</select></label>
          <button type="button" onClick={compare} className="px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900">Compare</button>
        </div>

        {comparisonError && <p className="mt-4 text-xs text-red-500">{comparisonError}</p>}
        {comparison?.data && Array.isArray(comparison.data) && comparison.data.length > 0 && <div className="mt-6 h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison.data}><CartesianGrid strokeDasharray="3 3" opacity={0.15} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}
      </section>
    </div>
  );
}

export default AIPredictions;
