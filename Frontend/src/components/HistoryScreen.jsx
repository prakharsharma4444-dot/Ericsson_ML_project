import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Trash2,
  Search,
  Filter,
  BarChart3,
  Target,
  Cpu,
  Clock3,
  X,
} from 'lucide-react';

function HistoryScreen({ theme }) {
  const isDark = theme === 'dark';

  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadHistory = () => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('ml_history') || '[]'
      );

      setHistory(Array.isArray(saved) ? saved : []);
    } catch (err) {
      console.error('Failed to load analysis history:', err);
      setHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();

    const handleStorage = (event) => {
      if (event.key === 'ml_history') {
        loadHistory();
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleDeleteRun = (runId) => {
    const updated = history.filter((run) => run.id !== runId);

    setHistory(updated);
    localStorage.setItem('ml_history', JSON.stringify(updated));
  };

  const handleClearHistory = () => {
    if (!window.confirm('Clear all saved analysis history?')) {
      return;
    }

    localStorage.removeItem('ml_history');
    setHistory([]);
  };

  const normalizedHistory = useMemo(
    () =>
      history.map((run) => {
        const problemType =
          run.problemType ||
          (run.target && String(run.target).toLowerCase().includes('priority')
            ? 'classification'
            : 'unknown');

        const metricName =
          run.metricName ||
          (problemType === 'classification' ? 'Metric' : 'R²');

        const metricValue =
          run.metricValue ||
          run.accuracy ||
          'N/A';

        const cvMetricName =
          run.cvMetricName ||
          (metricName ? `CV ${metricName}` : null);

        const cvMetricValue =
          run.cvMetricValue ||
          'N/A';

        return {
          ...run,
          problemType,
          metricName,
          metricValue,
          cvMetricName,
          cvMetricValue,
          model: run.model || 'Trained Model',
          target: run.target || 'Auto Target',
          dataset: run.dataset || 'Dataset.csv',
          date: run.date || 'Unknown date',
          status: run.status || 'Completed',
        };
      }),
    [history]
  );

  const filteredHistory = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();

    return normalizedHistory.filter((run) => {
      const matchesSearch =
        !term ||
        [
          run.id,
          run.dataset,
          run.target,
          run.model,
          run.problemType,
          run.metricName,
          run.status,
        ].some((value) =>
          String(value ?? '').toLowerCase().includes(term)
        );

      const matchesType =
        typeFilter === 'all' ||
        run.problemType === typeFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        String(run.status).toLowerCase() === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [normalizedHistory, searchQuery, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const completed = normalizedHistory.filter(
      (run) => String(run.status).toLowerCase() === 'completed'
    ).length;

    const regressionRuns = normalizedHistory.filter(
      (run) => run.problemType === 'regression'
    ).length;

    const classificationRuns = normalizedHistory.filter(
      (run) => run.problemType === 'classification'
    ).length;

    return {
      total: normalizedHistory.length,
      completed,
      regressionRuns,
      classificationRuns,
    };
  }, [normalizedHistory]);

  const hasFilters =
    searchQuery.trim() ||
    typeFilter !== 'all' ||
    statusFilter !== 'all';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h2
            className={`text-2xl font-bold ${
              isDark ? 'text-white' : 'text-slate-800'
            }`}
          >
            Analysis History
          </h2>

          <p
            className={`text-sm mt-0.5 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Review previous machine-learning runs saved on this device.
          </p>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center justify-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-semibold px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/10 transition"
          >
            <Trash2 size={14} />
            Clear History
          </button>
        )}
      </div>

      {history.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            icon={BarChart3}
            label="Total Analyses"
            value={stats.total}
            theme={theme}
          />

          <SummaryCard
            icon={CheckCircle2}
            label="Completed"
            value={stats.completed}
            theme={theme}
          />

          <SummaryCard
            icon={Target}
            label="Classification"
            value={stats.classificationRuns}
            theme={theme}
          />

          <SummaryCard
            icon={Clock3}
            label="Regression"
            value={stats.regressionRuns}
            theme={theme}
          />
        </div>
      )}

      {history.length > 0 && (
        <div
          className={`rounded-2xl border shadow-sm p-4 ${
            isDark
              ? 'bg-slate-800 border-slate-700'
              : 'bg-white border-slate-100'
          }`}
        >
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={15}
                className={`absolute left-3 top-1/2 -translate-y-1/2 ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              />

              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search dataset, target, model, or run ID..."
                className={`w-full pl-9 pr-9 py-2.5 rounded-lg text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-500'
                    : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                }`}
              />

              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${
                    isDark
                      ? 'text-slate-500 hover:text-slate-300'
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterSelect
                value={typeFilter}
                onChange={setTypeFilter}
                theme={theme}
                options={[
                  ['all', 'All types'],
                  ['classification', 'Classification'],
                  ['regression', 'Regression'],
                ]}
              />

              <FilterSelect
                value={statusFilter}
                onChange={setStatusFilter}
                theme={theme}
                options={[
                  ['all', 'All statuses'],
                  ['completed', 'Completed'],
                  ['failed', 'Failed'],
                ]}
              />
            </div>
          </div>
        </div>
      )}

      <div
        className={`rounded-2xl border shadow-sm overflow-hidden ${
          isDark
            ? 'bg-slate-800 border-slate-700'
            : 'bg-white border-slate-100'
        }`}
      >
        {normalizedHistory.length === 0 ? (
          <EmptyState />
        ) : filteredHistory.length === 0 ? (
          <div className="p-12 text-center">
            <Search size={28} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p
              className={`text-sm font-semibold ${
                isDark ? 'text-slate-200' : 'text-slate-700'
              }`}
            >
              No matching analyses
            </p>

            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Try a different search or clear your filters.
            </p>

            {hasFilters && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setTypeFilter('all');
                  setStatusFilter('all');
                }}
                className="mt-4 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden xl:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead
                  className={`font-semibold border-b ${
                    isDark
                      ? 'bg-slate-900/50 text-slate-400 border-slate-700'
                      : 'bg-slate-50/70 text-slate-400 border-slate-100'
                  }`}
                >
                  <tr>
                    <th className="p-4">Run</th>
                    <th className="p-4">Dataset</th>
                    <th className="p-4">Target / Task</th>
                    <th className="p-4">Model</th>
                    <th className="p-4">Performance</th>
                    <th className="p-4">Executed</th>
                    <th className="p-4 text-right">Status</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>

                <tbody
                  className={`divide-y font-medium ${
                    isDark
                      ? 'divide-slate-700/50 text-slate-300'
                      : 'divide-slate-100 text-slate-700'
                  }`}
                >
                  {filteredHistory.map((run) => (
                    <HistoryRow
                      key={run.id}
                      run={run}
                      theme={theme}
                      onDelete={handleDeleteRun}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="xl:hidden divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredHistory.map((run) => (
                <HistoryCard
                  key={run.id}
                  run={run}
                  theme={theme}
                  onDelete={handleDeleteRun}
                />
              ))}
            </div>

            <div
              className={`px-4 py-3 border-t text-[11px] ${
                isDark
                  ? 'border-slate-700 text-slate-500'
                  : 'border-slate-100 text-slate-400'
              }`}
            >
              Showing {filteredHistory.length} of {normalizedHistory.length} analyses
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, theme }) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm ${
        theme === 'dark'
          ? 'bg-slate-800 border-slate-700'
          : 'bg-white border-slate-100'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {label}
          </p>
          <p
            className={`text-xl font-bold mt-1 ${
              theme === 'dark' ? 'text-slate-100' : 'text-slate-800'
            }`}
          >
            {value}
          </p>
        </div>

        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            theme === 'dark'
              ? 'bg-blue-950/50 text-blue-400'
              : 'bg-blue-50 text-blue-600'
          }`}
        >
          <Icon size={17} />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, theme, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-2.5 rounded-lg text-xs border focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
        theme === 'dark'
          ? 'bg-slate-900 border-slate-700 text-slate-100'
          : 'bg-slate-50 border-slate-200 text-slate-700'
      }`}
    >
      {options.map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

function HistoryRow({ run, theme, onDelete }) {
  const isClassification = run.problemType === 'classification';

  return (
    <tr
      className={`transition ${
        theme === 'dark'
          ? 'hover:bg-slate-700/30'
          : 'hover:bg-slate-50/80'
      }`}
    >
      <td className="p-4">
        <p className="font-mono font-semibold text-blue-500 dark:text-blue-400">
          {run.id}
        </p>

        <span
          className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
            isClassification
              ? 'bg-violet-500/10 text-violet-500'
              : 'bg-amber-500/10 text-amber-500'
          }`}
        >
          {isClassification ? 'Classification' : 'Regression'}
        </span>
      </td>

      <td className="p-4">
        <div className="flex items-center gap-2">
          <Database size={14} className="text-slate-400" />
          <span
            className={`font-semibold ${
              theme === 'dark' ? 'text-slate-200' : 'text-slate-800'
            }`}
          >
            {run.dataset}
          </span>
        </div>
      </td>

      <td className="p-4">
        <p className="font-medium">{run.target}</p>

        {run.task && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 capitalize">
            {String(run.task).replaceAll('_', ' ')}
          </p>
        )}
      </td>

      <td className="p-4">
        <div className="flex items-center gap-1.5">
          <Cpu size={13} className="text-slate-400" />
          <span>{run.model}</span>
        </div>
      </td>

      <td className="p-4">
        <p className="font-bold text-emerald-500">
          {run.metricName}: {run.metricValue}
        </p>

        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
          {run.cvMetricName}: {run.cvMetricValue}
        </p>
      </td>

      <td className="p-4 text-slate-400 dark:text-slate-500 whitespace-nowrap">
        {run.date}
      </td>

      <td className="p-4 text-right">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 size={12} />
          {run.status}
        </span>
      </td>

      <td className="p-4 text-right">
        <button
          onClick={() => onDelete(run.id)}
          title="Delete this analysis"
          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

function HistoryCard({ run, theme, onDelete }) {
  const isClassification = run.problemType === 'classification';

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold text-blue-500 dark:text-blue-400">
            {run.id}
          </p>

          <p
            className={`text-sm font-semibold mt-1 ${
              theme === 'dark' ? 'text-slate-100' : 'text-slate-800'
            }`}
          >
            {run.dataset}
          </p>
        </div>

        <button
          onClick={() => onDelete(run.id)}
          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <InfoBlock label="Target" value={run.target} theme={theme} />
        <InfoBlock label="Model" value={run.model} theme={theme} />
        <InfoBlock
          label="Type"
          value={isClassification ? 'Classification' : 'Regression'}
          theme={theme}
        />
        <InfoBlock label="Executed" value={run.date} theme={theme} />
      </div>

      <div
        className={`rounded-lg p-3 ${
          isDarkTheme(theme)
            ? 'bg-slate-900/60 border border-slate-700'
            : 'bg-slate-50 border border-slate-100'
        }`}
      >
        <p className="text-[10px] text-slate-400 dark:text-slate-500">
          {run.metricName}
        </p>

        <p className="text-lg font-bold text-emerald-500 mt-0.5">
          {run.metricValue}
        </p>

        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
          {run.cvMetricName}: {run.cvMetricValue}
        </p>
      </div>

      <div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 size={12} />
          {run.status}
        </span>
      </div>
    </div>
  );
}

function InfoBlock({ label, value, theme }) {
  return (
    <div
      className={`rounded-lg p-3 ${
        theme === 'dark'
          ? 'bg-slate-900/50'
          : 'bg-slate-50'
      }`}
    >
      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        {label}
      </p>

      <p
        className={`text-xs font-semibold mt-1 break-words ${
          theme === 'dark' ? 'text-slate-200' : 'text-slate-700'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function isDarkTheme(theme) {
  return theme === 'dark';
}

function EmptyState() {
  return (
    <div className="p-14 text-center">
      <div className="w-12 h-12 mx-auto rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
        <BarChart3 size={22} className="text-blue-500 dark:text-blue-400" />
      </div>

      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-4">
        No analysis runs yet
      </h3>

      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-md mx-auto">
        Upload a dataset and train a model. Completed runs will appear here automatically.
      </p>
    </div>
  );
}

export default HistoryScreen;