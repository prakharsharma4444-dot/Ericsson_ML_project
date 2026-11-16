import { useState } from 'react';
import {
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Loader2,
  SlidersHorizontal,
  Flag,
  Clock3,
  UserCog,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { compareColumns } from '../api';

const TICKET_PRESETS = [
  {
    task: 'priority',
    icon: Flag,
    label: 'Predict Ticket Priority',
    type: 'Classification',
    description: 'Classify the ticket as Low, Medium, High, or Critical.',
  },
  {
    task: 'resolution',
    icon: Clock3,
    label: 'Predict Resolution Time',
    type: 'Regression',
    description: 'Estimate the expected resolution time in hours.',
  },
  {
    task: 'owner',
    icon: UserCog,
    label: 'Predict Case Owner',
    type: 'Classification',
    description: 'Recommend the most likely case owner for the ticket.',
  },
];

function AIPredictions({ sessionId, columns = [], onSelectTarget, onSelectTask }) {
  const colNames = columns.map((c) => (typeof c === 'object' ? c.name : c));
  const [target, setTarget] = useState('');
  const [xCol, setXCol] = useState(colNames[0] || '');
  const [yCol, setYCol] = useState(colNames[1] || colNames[0] || '');
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(null);
  const [comparisonError, setComparisonError] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const normalizedCols = colNames.map((c) => String(c).trim().toLowerCase());
  const looksLikeSupportTickets = [
    'priority',
    'case owner',
    'solution target',
  ].every((col) => normalizedCols.includes(col));

  const trainTask = async (task) => {
    if (!onSelectTask || loading) return;
    setLoading(task);
    try {
      await onSelectTask(task);
    } finally {
      setLoading(null);
    }
  };

  const trainGeneric = async () => {
    if (!target || !onSelectTarget || loading) return;
    setLoading('generic');
    try {
      await onSelectTarget(target);
    } finally {
      setLoading(null);
    }
  };

  const compare = async () => {
    if (!sessionId || !xCol || !yCol) return;
    setComparisonError('');
    try {
      setComparison(await compareColumns(sessionId, xCol, yCol));
    } catch (err) {
      setComparisonError(err.message || 'Unable to compare the selected columns.');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <p className="text-xs uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400">
          Ticket Model Studio
        </p>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">
          Analyze & Predict
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Train support-ticket models, compare their performance, and generate predictions from the available ticket information.
        </p>
      </div>

      {looksLikeSupportTickets ? (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <BrainCircuit size={19} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Support-ticket prediction tasks
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Choose a practical operational outcome to predict.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {TICKET_PRESETS.map(({ task, icon: Icon, label, type, description }) => {
              const active = loading === task;
              return (
                <button
                  key={task}
                  type="button"
                  disabled={Boolean(loading)}
                  onClick={() => trainTask(task)}
                  className={
                    'text-left rounded-xl border p-5 transition-all ' +
                    (active
                      ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30'
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20')
                  }
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                      {active ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
                    </div>
                    <span className="px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      {type}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100 mt-4">{label}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-5">
                    {description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
              <BrainCircuit size={19} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Choose a prediction target
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Classification and regression are inferred from the selected target.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end">
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Target column</span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                disabled={Boolean(loading)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select a target…</option>
                {colNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>

            <button
              type="button"
              onClick={trainGeneric}
              disabled={!target || Boolean(loading)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-40"
            >
              {loading === 'generic' && <Loader2 size={16} className="animate-spin" />}
              {loading === 'generic' ? 'Running ML pipeline…' : 'Train & Compare'}
            </button>
          </div>
        </section>
      )}

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
        <div className="flex items-start gap-3 mb-5">
          <BarChart3 size={19} className="text-indigo-600 dark:text-indigo-400 mt-0.5" />
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Column Relationship Explorer
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Compare ticket fields before deciding what to model.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <label>
            <span className="text-xs font-medium text-slate-500">Column A</span>
            <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm">
              {colNames.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>

          <label>
            <span className="text-xs font-medium text-slate-500">Column B</span>
            <select value={yCol} onChange={(e) => setYCol(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm">
              {colNames.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>

          <button type="button" onClick={compare} className="px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900">
            Compare
          </button>
        </div>

        {comparisonError && <p className="mt-4 text-xs text-red-500">{comparisonError}</p>}
        {comparison?.data && Array.isArray(comparison.data) && comparison.data.length > 0 && (
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparison.data}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4">
          <button
            type="button"
            onClick={() => setAdvancedOpen((open) => !open)}
            className="w-full flex items-center justify-between text-left text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <span className="flex items-center gap-2"><SlidersHorizontal size={14} />Advanced target selection</span>
            {advancedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {advancedOpen && (
            <div className="mt-4 flex flex-wrap gap-2">
              {colNames.map((name) => (
                <button key={name} type="button" onClick={() => setTarget(name)} className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:border-indigo-400 hover:text-indigo-600">
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default AIPredictions;
