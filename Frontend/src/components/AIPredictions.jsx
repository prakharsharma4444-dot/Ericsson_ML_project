import { useState } from 'react';
import {
  Sparkles,
  Flag,
  Clock,
  UserCog,
  GitBranch,
  ChevronDown,
  ChevronUp,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  SlidersHorizontal,
  BarChart3,
  X,
} from 'lucide-react';
import {
  ScatterChart,
  Scatter,
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
    label: 'Predict Priority',
    type: 'Classification',
    description: 'Classify the ticket as Low, Medium, High, or Critical.',
  },
  {
    task: 'resolution',
    icon: Clock,
    label: 'Predict Resolution Time',
    type: 'Regression',
    description: 'Estimate how many hours the ticket is expected to take to resolve.',
  },
  {
    task: 'owner',
    icon: UserCog,
    label: 'Predict Best Worker',
    type: 'Classification',
    description: 'Recommend the most suitable case owner for the ticket.',
  },
];

const TICKET_SIGNATURE_COLUMNS = ['priority', 'case owner', 'solution target'];

function AIPredictions({ sessionId, columns = [], onSelectTarget, onSelectTask }) {
  const colNames = columns.map((c) => (typeof c === 'object' ? c.name : c));
  const [xCol, setXCol] = useState(colNames[0] || '');
  const [yCol, setYCol] = useState(colNames[1] || colNames[0] || '');
  const [comparison, setComparison] = useState(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState(null);
  const [taskLoading, setTaskLoading] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const normalizedCols = colNames.map((c) => String(c).trim().toLowerCase());
  const looksLikeTicketData = TICKET_SIGNATURE_COLUMNS.every((col) =>
    normalizedCols.includes(col)
  );

  const handleTaskClick = async (task) => {
    if (!onSelectTask || taskLoading) return;

    setTaskLoading(task);
    try {
      await onSelectTask(task);
    } finally {
      setTaskLoading(null);
    }
  };

  const handlePlot = async () => {
    if (!sessionId || !xCol || !yCol || comparisonLoading) return;

    setComparisonLoading(true);
    setComparisonError(null);

    try {
      const result = await compareColumns(sessionId, xCol, yCol);
      setComparison(result);
    } catch (err) {
      setComparisonError(err.message || 'Unable to compare the selected columns.');
    } finally {
      setComparisonLoading(false);
    }
  };

  const clearComparison = () => {
    setComparison(null);
    setComparisonError(null);
  };

  const handleXChange = (value) => {
    setXCol(value);
    setComparison(null);
    setComparisonError(null);
  };

  const handleYChange = (value) => {
    setYCol(value);
    setComparison(null);
    setComparisonError(null);
  };

  const comparisonTitle = comparison
    ? `${comparison.col1} vs ${comparison.col2}`
    : 'Column Relationship Explorer';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Sparkles size={22} className="text-blue-600 dark:text-blue-400" />
          AI Predictions
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Train models on your data, compare their performance, and generate predictions from human-readable ticket information.
        </p>
      </div>

      {/* Prediction tasks are the primary workflow. */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 transition-colors">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Select a Prediction Task
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {looksLikeTicketData
                ? 'Ericsson support-ticket workflow detected. Choose the outcome you want to predict.'
                : 'Choose a column to use as the prediction target.'}
            </p>
          </div>
          {looksLikeTicketData && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-300">
              <CheckCircle2 size={13} />
              Ericsson ticket data detected
            </div>
          )}
        </div>

        {looksLikeTicketData ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {TICKET_PRESETS.map(({ task, icon: Icon, label, type, description }) => {
                const isTraining = taskLoading === task;
                const disabled = Boolean(taskLoading);

                return (
                  <button
                    key={task}
                    type="button"
                    onClick={() => handleTaskClick(task)}
                    disabled={disabled}
                    className={`group relative overflow-hidden text-left rounded-xl border p-5 transition-all duration-200 ${
                      isTraining
                        ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-md'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/60 dark:hover:bg-blue-950/20 hover:-translate-y-0.5 hover:shadow-md'
                    } ${disabled && !isTraining ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                        {isTraining ? <Loader2 size={19} className="animate-spin" /> : <Icon size={19} />}
                      </div>
                      <span className="px-2 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {type}
                      </span>
                    </div>

                    <p className="font-semibold text-slate-800 dark:text-slate-100 mt-4">
                      {isTraining ? `Training ${label.replace('Predict ', '')}...` : label}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-5">
                      {isTraining ? 'Preparing features and comparing candidate models.' : description}
                    </p>

                    {!isTraining && (
                      <div className="flex items-center gap-1.5 mt-4 text-xs font-semibold text-blue-600 dark:text-blue-400">
                        Start analysis
                        <span className="transition-transform group-hover:translate-x-0.5">→</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-lg border border-blue-100 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/20 p-4">
              <div className="mt-0.5 text-blue-600 dark:text-blue-400">
                <BrainCircuit size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">
                  Automatic feature engineering
                </p>
                <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-1 leading-5">
                  You enter information a support engineer can realistically provide. The backend automatically generates sentiment, TF-IDF, categorical encodings, and other machine-learning features in the background.
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setAdvancedOpen((open) => !open)}
                className="w-full flex items-center justify-between text-left text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal size={14} />
                  Advanced: choose a different target column
                </span>
                {advancedOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {advancedOpen && (
                <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-4">
                  <p className="text-xs text-amber-800 dark:text-amber-200 mb-3">
                    Use this only when you intentionally want to train the general-purpose pipeline on a different target.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {colNames.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => onSelectTarget && onSelectTarget(c)}
                        className="px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={15} className="text-slate-400" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Available target columns</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {colNames.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => onSelectTarget && onSelectTarget(c)}
                  disabled={Boolean(taskLoading)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition disabled:opacity-50"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Optional relationship explorer comes after the prediction workflow. */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <GitBranch size={17} className="text-blue-600 dark:text-blue-400" />
              {comparisonTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Explore relationships between two dataset columns without changing the trained model.
            </p>
          </div>
          {comparison && (
            <button
              type="button"
              onClick={clearComparison}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">
              X-Axis Variable
            </label>
            <select
              value={xCol}
              onChange={(e) => handleXChange(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
            >
              {colNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">
              Y-Axis Variable
            </label>
            <select
              value={yCol}
              onChange={(e) => handleYChange(e.target.value)}
              className="w-full border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
            >
              {colNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={handlePlot}
            disabled={comparisonLoading || !sessionId || !xCol || !yCol}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition"
          >
            {comparisonLoading ? <Loader2 size={15} className="animate-spin" /> : <BarChart3 size={15} />}
            {comparisonLoading ? 'Building comparison...' : 'Plot Comparison'}
          </button>
        </div>

        {comparisonError && (
          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded-lg p-3 mb-4">
            {comparisonError}
          </div>
        )}

        <div className="border border-slate-100 dark:border-slate-800 rounded-xl min-h-[280px] flex items-center justify-center bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden">
          {!comparison && !comparisonLoading && !comparisonError && (
            <div className="text-center py-10 px-6">
              <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center mx-auto mb-3">
                <GitBranch size={20} className="text-blue-500 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No comparison yet</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                Choose two columns and click Plot Comparison to visualize their relationship.
              </p>
            </div>
          )}

          {comparisonLoading && (
            <div className="text-center py-10">
              <Loader2 size={24} className="animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Building comparison...</p>
            </div>
          )}

          {comparison?.chart_type === 'scatter' && (
            <div className="w-full h-72 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94A3B8" strokeOpacity={0.2} />
                  <XAxis dataKey={comparison.col1} name={comparison.col1} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis dataKey={comparison.col2} name={comparison.col2} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
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
                  <Bar
                    dataKey={Object.keys(comparison.data[0] || {}).find((k) => k !== Object.keys(comparison.data[0] || {})[0]) || 'mean'}
                    fill="#2563EB"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {comparison?.chart_type === 'crosstab' && (
            <div className="text-center px-6 py-10">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Both columns are categorical</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                Head to Data Exploration for the full cross-tabulation table and filtering tools.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIPredictions;