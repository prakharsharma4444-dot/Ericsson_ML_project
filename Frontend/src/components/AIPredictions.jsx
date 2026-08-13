import { useState } from 'react';
import { Sparkles, Flag, Clock, UserCog, GitBranch } from 'lucide-react';
import { ScatterChart, Scatter, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { compareColumns } from '../api';

const TICKET_PRESETS = [
  { task: 'priority', icon: Flag, label: 'Predict Priority', description: 'Classify ticket priority (Low / Medium / High / Critical)' },
  { task: 'resolution', icon: Clock, label: 'Predict Resolution Time', description: 'Estimate hours from ticket open to solution target' },
  { task: 'owner', icon: UserCog, label: 'Predict Best Worker', description: 'Recommend which case owner should handle a ticket' },
];

const TICKET_SIGNATURE_COLUMNS = ['priority', 'case owner', 'solution target'];

function AIPredictions({ sessionId, columns = [], onSelectTarget, onSelectTask }) {
  const colNames = columns.map((c) => (typeof c === 'object' ? c.name : c));
  const [xCol, setXCol] = useState(colNames[0] || '');
  const [yCol, setYCol] = useState(colNames[1] || colNames[0] || '');
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizedCols = colNames.map((c) => String(c).trim().toLowerCase());
  const looksLikeTicketData = TICKET_SIGNATURE_COLUMNS.every((col) => normalizedCols.includes(col));

  const handlePlot = async () => {
    if (!sessionId || !xCol || !yCol) return;
    setLoading(true);
    setError(null);
    try {
      const result = await compareColumns(sessionId, xCol, yCol);
      setComparison(result);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Sparkles size={22} className="text-blue-600 dark:text-blue-400" />
          AI Predictions
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Analyze data and predict outcomes using machine learning models.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">X-Axis Variable</label>
            <select
              value={xCol}
              onChange={(e) => setXCol(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
            >
              {colNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Y-Axis Variable</label>
            <select
              value={yCol}
              onChange={(e) => setYCol(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
            >
              {colNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handlePlot}
          disabled={loading || !sessionId}
          className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
        >
          {loading ? 'Plotting...' : 'Plot Comparison'}
        </button>

        {error && <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded-lg p-3 mb-4">{error}</div>}

        <div className="border border-slate-100 dark:border-slate-800 rounded-xl min-h-[280px] flex items-center justify-center bg-slate-50/50 dark:bg-slate-800/30">
          {!comparison && !loading && (
            <div className="text-center py-10">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center mx-auto mb-3">
                <GitBranch size={20} className="text-blue-500 dark:text-blue-400" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Data visualization will render here based on selected axes.</p>
            </div>
          )}

          {comparison?.chart_type === 'scatter' && (
            <div className="w-full h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94A3B8" strokeOpacity={0.2} />
                  <XAxis dataKey={comparison.col1} name={comparison.col1} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis dataKey={comparison.col2} name={comparison.col2} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Scatter data={comparison.data} fill="#2563EB" fillOpacity={0.6} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}

          {comparison?.chart_type === 'boxplot' && (
            <div className="w-full h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison.data} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94A3B8" strokeOpacity={0.2} />
                  <XAxis dataKey={Object.keys(comparison.data[0] || {})[0]} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey={Object.keys(comparison.data[0] || {}).find((k) => k !== Object.keys(comparison.data[0] || {})[0]) || 'mean'} fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {comparison?.chart_type === 'crosstab' && (
            <p className="text-xs text-slate-500 dark:text-slate-400 p-6 text-center">
              Both columns are categorical — head to the Data Exploration screen for a full cross-tabulation table of these two columns.
            </p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 transition-colors">
        <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">Select a Prediction Task</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          {looksLikeTicketData
            ? 'This looks like Ericsson support-ticket data. Pick what you want to predict:'
            : 'Pick a target column to predict:'}
        </p>

        {looksLikeTicketData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {TICKET_PRESETS.map(({ task, icon: Icon, label, description }) => (
              <button
                key={task}
                onClick={() => onSelectTask && onSelectTask(task)}
                className="text-left bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-5 transition shadow-sm"
              >
                <div className="w-9 h-9 rounded-full bg-white/15 dark:bg-white/20 flex items-center justify-center mb-4">
                  <Icon size={18} />
                </div>
                <p className="font-semibold mb-1">{label}</p>
                <p className="text-xs text-blue-100">{description}</p>
              </button>
            ))}
          </div>
        )}

        {looksLikeTicketData && <div className="border-t border-slate-100 dark:border-slate-800 mb-4" />}

        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
          {looksLikeTicketData ? 'Or pick a raw column below instead:' : 'Available columns:'}
        </p>
        <div className="flex flex-wrap gap-2">
          {colNames.map((c) => (
            <button
              key={c}
              onClick={() => onSelectTarget && onSelectTarget(c)}
              className="px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AIPredictions;