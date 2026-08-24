import { useState, useEffect, useMemo } from 'react';
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
  Cell,
} from 'recharts';
import {
  AlertTriangle,
  ShieldCheck,
  Hash,
  Type,
  X,
  Search,
  Download,
  ArrowLeft,
  Loader2,
  Database,
  Rows3,
  Columns3,
  Copy,
  Filter,
  Lightbulb,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  BarChart3,
  Table2,
  Activity,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { getPreview, compareColumns, getColumnDetail, getReportUrl } from '../api';
import PivotBuilder from './PivotBuilder';

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl shadow-xl text-xs text-slate-800 dark:text-slate-100">
      {label !== undefined && label !== null && (
        <p className="font-semibold mb-2 text-slate-900 dark:text-white">{String(label)}</p>
      )}
      {payload.map((entry, index) => (
        <p key={index} className="mb-1 last:mb-0" style={{ color: entry.color || entry.fill || '#3b82f6' }}>
          <span className="font-medium">{entry.name || entry.dataKey}: </span>
          {typeof entry.value === 'number' ? entry.value.toLocaleString() : String(entry.value)}
        </p>
      ))}
    </div>
  );
};

const formatNumber = (value, digits = 0) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  return Number(value).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
};

const formatPercent = (value) => `${formatNumber(value, 1)}%`;

const normalizeName = (name = '') => String(name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const findColumn = (headers, patterns) => {
  const normalized = headers.map((h) => ({ raw: h, normalized: normalizeName(h) }));
  for (const pattern of patterns) {
    const hit = normalized.find((item) => item.normalized.includes(pattern));
    if (hit) return hit.raw;
  }
  return null;
};

export default function DataExploreScreen({ sessionId, columns = [], onContinue, onBack }) {
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [error, setError] = useState(null);

  const colNames = useMemo(() => {
    if (!Array.isArray(columns)) return [];
    return columns.map((c) => {
      if (typeof c === 'string') return c;
      if (typeof c === 'object' && c !== null) return c.name || c.column || c.label || String(c);
      return String(c);
    });
  }, [columns]);

  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [profileFilter, setProfileFilter] = useState('all');
  const [selectedCol, setSelectedCol] = useState(null);
  const [colDetail, setColDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const [col1, setCol1] = useState('');
  const [col2, setCol2] = useState('');
  const [comparison, setComparison] = useState(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoadingPreview(true);
    setError(null);

    getPreview(sessionId)
      .then((data) => {
        if (!isMounted) return;
        setPreview(data);
        setLoadingPreview(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to load dataset preview.');
        setLoadingPreview(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!colNames.length) return;
    setCol1((prev) => (prev && colNames.includes(prev) ? prev : colNames[0]));
    setCol2((prev) => (prev && colNames.includes(prev) ? prev : colNames[1] || colNames[0]));
  }, [colNames]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, profileFilter, rowsPerPage]);

  const rawRows = useMemo(() => preview?.preview || [], [preview]);

  const tableHeaders = useMemo(() => {
    if (rawRows.length > 0) return Object.keys(rawRows[0]);
    return colNames;
  }, [rawRows, colNames]);

  const columnStats = useMemo(() => preview?.column_stats || [], [preview]);

  const filteredStats = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return columnStats.filter((col) => {
      const matchesSearch = !term || String(col.name).toLowerCase().includes(term);
      const matchesFilter =
        profileFilter === 'all' ||
        (profileFilter === 'numeric' && col.type === 'Numeric') ||
        (profileFilter === 'categorical' && col.type !== 'Numeric') ||
        (profileFilter === 'missing' && Number(col.missing_pct || 0) > 0);

      return matchesSearch && matchesFilter;
    });
  }, [columnStats, searchTerm, profileFilter]);

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) return rawRows;
    const { key, direction } = sortConfig;

    return [...rawRows].sort((a, b) => {
      const av = a?.[key];
      const bv = b?.[key];
      const aNum = Number(av);
      const bNum = Number(bv);
      const bothNumeric = av !== '' && bv !== '' && Number.isFinite(aNum) && Number.isFinite(bNum);

      let result;
      if (bothNumeric) {
        result = aNum - bNum;
      } else {
        result = String(av ?? '').localeCompare(String(bv ?? ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      }

      return direction === 'asc' ? result : -result;
    });
  }, [rawRows, sortConfig]);

  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return sortedRows;
    const term = searchTerm.toLowerCase();
    return sortedRows.filter((row) =>
      Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(term))
    );
  }, [sortedRows, searchTerm]);

  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const displayedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

  const numericColumnCount = columnStats.filter((c) => c.type === 'Numeric').length;
  const categoricalColumnCount = columnStats.length - numericColumnCount;
  const duplicateRows = useMemo(() => {
    if (!rawRows.length) return 0;
    const seen = new Set();
    let duplicates = 0;
    rawRows.forEach((row) => {
      const key = JSON.stringify(row);
      if (seen.has(key)) duplicates += 1;
      else seen.add(key);
    });
    return duplicates;
  }, [rawRows]);

  const missingColumnsCount = columnStats.filter((c) => Number(c.missing_pct || 0) > 0).length;
  const highMissingColumns = columnStats.filter((c) => Number(c.missing_pct || 0) > 20).length;

  const detectedColumns = useMemo(() => {
    return {
      priority: findColumn(tableHeaders, ['priority']),
      product: findColumn(tableHeaders, ['product']),
      status: findColumn(tableHeaders, ['status']),
      resolution: findColumn(tableHeaders, ['resolution time', 'solution target', 'target solution', 'resolution hours']),
      callback: findColumn(tableHeaders, ['callback', 'call back']),
      open: findColumn(tableHeaders, ['hours open', 'time open']),
      owner: findColumn(tableHeaders, ['case owner', 'owner']),
    };
  }, [tableHeaders]);

  const quickInsights = useMemo(() => {
    const insights = [];

    if (detectedColumns.priority && rawRows.length) {
      const counts = {};
      rawRows.forEach((row) => {
        const value = row[detectedColumns.priority];
        if (value !== null && value !== undefined && value !== '') counts[value] = (counts[value] || 0) + 1;
      });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top) {
        insights.push({ label: 'Most common priority', value: String(top[0]), detail: `${formatPercent((top[1] / rawRows.length) * 100)} of visible rows`, tone: 'blue' });
      }
    }

    if (detectedColumns.product && rawRows.length) {
      const counts = {};
      rawRows.forEach((row) => {
        const value = row[detectedColumns.product];
        if (value !== null && value !== undefined && value !== '') counts[value] = (counts[value] || 0) + 1;
      });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top) {
        insights.push({ label: 'Most common product', value: String(top[0]), detail: `${formatPercent((top[1] / rawRows.length) * 100)} of visible rows`, tone: 'violet' });
      }
    }

    if (detectedColumns.status && rawRows.length) {
      const counts = {};
      rawRows.forEach((row) => {
        const value = row[detectedColumns.status];
        if (value !== null && value !== undefined && value !== '') counts[value] = (counts[value] || 0) + 1;
      });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top) {
        insights.push({ label: 'Most common status', value: String(top[0]), detail: `${formatPercent((top[1] / rawRows.length) * 100)} of visible rows`, tone: 'emerald' });
      }
    }

    const resolutionStat = columnStats.find((c) => c.name === detectedColumns.resolution);
    if (resolutionStat?.mean !== undefined) {
      insights.push({ label: 'Average resolution measure', value: formatNumber(resolutionStat.mean, 1), detail: resolutionStat.name, tone: 'amber' });
    }

    const callbackStat = columnStats.find((c) => c.name === detectedColumns.callback);
    if (callbackStat?.mean !== undefined) {
      insights.push({ label: 'Average callback target', value: formatNumber(callbackStat.mean, 1), detail: callbackStat.name, tone: 'cyan' });
    }

    if (detectedColumns.open) {
      const openStat = columnStats.find((c) => c.name === detectedColumns.open);
      if (openStat?.max !== undefined) {
        insights.push({ label: 'Longest open value', value: formatNumber(openStat.max, 1), detail: openStat.name, tone: 'rose' });
      }
    }

    return insights.slice(0, 6);
  }, [detectedColumns, rawRows, columnStats]);

  const handleInspectColumn = async (colName) => {
    setSelectedCol(colName);
    setLoadingDetail(true);
    setColDetail(null);
    try {
      const data = await getColumnDetail(sessionId, colName);
      setColDetail(data);
    } catch (err) {
      setError(err.message || `Could not inspect ${colName}.`);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCompare = async () => {
    if (!col1 || !col2) return;
    setLoadingCompare(true);
    setError(null);
    try {
      const result = await compareColumns(sessionId, col1, col2);
      setComparison(result);
    } catch (err) {
      setError(err.message || 'Failed to generate comparison visual.');
    } finally {
      setLoadingCompare(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handleExportStats = () => {
    if (!preview?.column_stats) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(preview.column_stats, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `dataset_summary_${sessionId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const resetAnalysis = () => {
    setComparison(null);
    setSearchTerm('');
    setProfileFilter('all');
    setSelectedCol(null);
    setSortConfig({ key: null, direction: 'asc' });
    setCurrentPage(1);
    setError(null);
  };

  const getTypeStyle = (type) =>
    type === 'Numeric'
      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800/50'
      : 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800/50';

  const comparisonSummary = useMemo(() => {
    if (!comparison) return null;
    if (comparison.chart_type === 'scatter' && comparison.correlation !== undefined) {
      const r = Number(comparison.correlation);
      const abs = Math.abs(r);
      let strength = 'weak';
      if (abs >= 0.7) strength = 'strong';
      else if (abs >= 0.4) strength = 'moderate';
      const direction = r >= 0 ? 'positive' : 'negative';
      return `This comparison shows a ${strength} ${direction} relationship based on Pearson correlation.`;
    }
    if (comparison.chart_type === 'boxplot') {
      return 'The bars compare the average numeric value across categories. Large differences suggest the category may be associated with different outcomes.';
    }
    if (comparison.chart_type === 'crosstab') {
      return 'The crosstab shows how often the categories in the two selected columns occur together.';
    }
    return null;
  }, [comparison]);

  if (loadingPreview) {
    return (
      <div className="min-h-full p-6 text-slate-900 dark:text-slate-100 transition-colors duration-200">
        <div className="max-w-7xl mx-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm py-28 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
          <p className="mt-4 text-sm font-medium text-slate-600 dark:text-slate-300">Loading dataset workspace...</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Preparing health checks, profiles, and exploration tools.</p>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="min-h-full p-6 text-slate-900 dark:text-slate-100">
        <div className="max-w-7xl mx-auto rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 p-8 shadow-sm">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">Dataset could not be loaded.</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{error || 'Please upload the dataset again.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full p-4 sm:p-6 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <div>
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition mb-3"
              >
                <ArrowLeft size={14} /> Back to Previous Step
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/50">
                <Database size={21} />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Dataset Analysis</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Profile data health, inspect columns, discover relationships, and build summaries.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={resetAnalysis}
              className="inline-flex items-center gap-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-lg text-xs font-medium transition"
            >
              <RefreshCw size={14} /> Reset View
            </button>
            <button
              onClick={handleExportStats}
              disabled={!preview?.column_stats}
              className="inline-flex items-center gap-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3.5 py-2.5 rounded-lg text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} /> Export Summary
            </button>
            <button
              onClick={() => window.open(getReportUrl(sessionId), '_blank')}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-xs font-semibold transition shadow-sm"
            >
              <span>📑</span> Full Report
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-xs font-medium hover:underline">Dismiss</button>
          </div>
        )}

        {/* Overview metrics */}
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <MetricCard icon={Rows3} label="Rows" value={formatNumber(preview.n_rows)} tone="blue" />
          <MetricCard icon={Columns3} label="Columns" value={formatNumber(preview.n_cols)} tone="violet" />
          <MetricCard icon={AlertTriangle} label="Missing Values" value={formatNumber(preview.missing_values)} tone={preview.missing_values > 0 ? 'amber' : 'emerald'} />
          <MetricCard icon={Copy} label="Duplicate Rows" value={formatNumber(duplicateRows)} tone={duplicateRows > 0 ? 'amber' : 'emerald'} />
          <MetricCard icon={Hash} label="Numeric" value={formatNumber(numericColumnCount)} tone="blue" />
          <MetricCard icon={Type} label="Categorical" value={formatNumber(categoricalColumnCount)} tone="violet" />
        </section>

        {/* Quick insights */}
        {quickInsights.length > 0 && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Lightbulb size={17} className="text-amber-500" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Quick Insights</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Business-level signals surfaced automatically from the uploaded dataset.</p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <Activity size={12} /> Automatic
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {quickInsights.map((insight, index) => (
                <InsightCard key={`${insight.label}-${index}`} {...insight} />
              ))}
            </div>
          </section>
        )}

        {/* Data quality */}
        <section className={`rounded-2xl border p-5 shadow-sm ${preview.alerts?.length ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'}`}>
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="flex gap-3">
              {preview.alerts?.length ? (
                <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              )}
              <div>
                <p className={`text-sm font-semibold ${preview.alerts?.length ? 'text-amber-900 dark:text-amber-200' : 'text-emerald-900 dark:text-emerald-200'}`}>
                  {preview.alerts?.length ? `${preview.alerts.length} data-quality warning${preview.alerts.length === 1 ? '' : 's'} detected` : 'Dataset passed initial health checks'}
                </p>
                <p className={`text-xs mt-1 ${preview.alerts?.length ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'}`}>
                  {highMissingColumns > 0
                    ? `${highMissingColumns} column${highMissingColumns === 1 ? '' : 's'} has more than 20% missing values.`
                    : missingColumnsCount > 0
                      ? `${missingColumnsCount} column${missingColumnsCount === 1 ? '' : 's'} contain missing values.`
                      : 'No major missingness issue was detected in the initial profile.'}
                </p>
              </div>
            </div>

            {preview.alerts?.length > 0 && (
              <div className="flex flex-wrap gap-2 lg:max-w-[58%] justify-start lg:justify-end">
                {preview.alerts.slice(0, 4).map((alert, index) => (
                  <span key={index} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white/70 dark:bg-slate-900/40 border border-amber-200/80 dark:border-amber-800/50 text-amber-900 dark:text-amber-200">
                    {String(alert)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Main workspace */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-5 pt-5 pb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Explore Your Dataset</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Switch between structural health, raw records, and interactive relationships.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={BarChart3} label="Overview" />
              <TabButton active={activeTab === 'profiling'} onClick={() => setActiveTab('profiling')} icon={SlidersHorizontal} label="Column Health" />
              <TabButton active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} icon={Table2} label="Raw Data" />
            </div>
          </div>

          <div className="px-5 pb-5">
            {activeTab === 'overview' && (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 p-5">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Relationship Explorer</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Pick two columns to visualize how they interact.</p>
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-slate-500">Charts adapt automatically to the selected data types.</div>
                  </div>

                  <RelationshipControls
                    colNames={colNames}
                    col1={col1}
                    col2={col2}
                    setCol1={setCol1}
                    setCol2={setCol2}
                    onCompare={handleCompare}
                    loading={loadingCompare}
                  />

                  {comparison && (
                    <ComparisonPanel comparison={comparison} summary={comparisonSummary} />
                  )}
                </div>
              </div>
            )}

            {activeTab === 'profiling' && (
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {[
                      ['all', 'All'],
                      ['numeric', 'Numeric'],
                      ['categorical', 'Categorical'],
                      ['missing', 'Has Missing Values'],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setProfileFilter(key)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${profileFilter === key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        {key === 'all' ? null : <Filter size={12} />}
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full lg:w-72">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search columns..."
                      className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>Showing {filteredStats.length} of {columnStats.length} columns</span>
                  <span>Click any row to inspect the distribution.</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="px-3 py-3 font-semibold">Feature</th>
                        <th className="px-3 py-3 font-semibold">Type</th>
                        <th className="px-3 py-3 font-semibold">Missing</th>
                        <th className="px-3 py-3 font-semibold">Unique</th>
                        <th className="px-3 py-3 font-semibold">Range</th>
                        <th className="px-3 py-3 font-semibold">Mean / Median</th>
                        <th className="px-3 py-3 text-right font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredStats.length > 0 ? (
                        filteredStats.map((col, idx) => (
                          <tr
                            key={`${col.name}-${idx}`}
                            onClick={() => handleInspectColumn(col.name)}
                            className="hover:bg-blue-50/50 dark:hover:bg-slate-800/60 cursor-pointer transition group"
                          >
                            <td className="px-3 py-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{col.name}</td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${getTypeStyle(col.type)}`}>
                                {col.type === 'Numeric' ? <Hash size={11} /> : <Type size={11} />}
                                {col.type}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2 min-w-[120px]">
                                <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                  <div
                                    className={`h-full ${Number(col.missing_pct || 0) > 20 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.min(Number(col.missing_pct || 0), 100)}%` }}
                                  />
                                </div>
                                <span className="font-medium text-slate-600 dark:text-slate-400">{formatPercent(Number(col.missing_pct || 0))}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{formatNumber(col.unique_count)}</td>
                            <td className="px-3 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {col.type === 'Numeric' && col.min !== undefined ? `${formatNumber(col.min, 2)} → ${formatNumber(col.max, 2)}` : '—'}
                            </td>
                            <td className="px-3 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {col.type === 'Numeric' && col.mean !== undefined ? `${formatNumber(col.mean, 2)} / ${formatNumber(col.median, 2)}` : '—'}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                Inspect <Search size={12} />
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-3 py-10 text-center text-slate-400 dark:text-slate-500">
                            No columns match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'preview' && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Raw Data Preview</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Search across visible rows and sort any column.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative w-56">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search rows..."
                        className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(Number(e.target.value))}
                      className="px-3 py-2.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      {[15, 25, 50].map((size) => <option key={size} value={size}>{size} rows</option>)}
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                        {tableHeaders.map((col) => {
                          const active = sortConfig.key === col;
                          return (
                            <th key={col} className="text-left p-0 border-r last:border-r-0 border-slate-100 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              <button
                                onClick={() => handleSort(col)}
                                className="w-full text-left px-3 py-3 flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                              >
                                <span>{col}</span>
                                {active ? (sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="text-slate-300 dark:text-slate-600" />}
                              </button>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRows.length > 0 ? (
                        displayedRows.map((row, i) => (
                          <tr key={i} className="hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors">
                            {tableHeaders.map((col, j) => {
                              const val = row[col];
                              return (
                                <td key={j} className="p-3 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 whitespace-nowrap max-w-[280px] truncate" title={typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '')}>
                                  {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '')}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={Math.max(tableHeaders.length, 1)} className="p-10 text-center text-slate-400 dark:text-slate-500">No rows match the current search.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span>{totalRows ? `Showing ${startIndex + 1}–${Math.min(startIndex + rowsPerPage, totalRows)} of ${totalRows}` : '0 rows'}</span>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium">Page {currentPage} / {totalPages}</span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Relationship explorer */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 size={17} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Pairwise Relationship Visualizer</h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Compare any two columns and let the system choose the appropriate visualization.</p>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Supports numeric, categorical, and mixed comparisons</span>
          </div>

          <RelationshipControls
            colNames={colNames}
            col1={col1}
            col2={col2}
            setCol1={setCol1}
            setCol2={setCol2}
            onCompare={handleCompare}
            loading={loadingCompare}
          />

          {comparison ? (
            <ComparisonPanel comparison={comparison} summary={comparisonSummary} />
          ) : (
            <EmptyAnalysisState title="No comparison yet" text="Choose two columns and click Analyze to see a relationship chart here." />
          )}
        </section>

        {/* Pivot */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Table2 size={17} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Pivot Analysis</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">Summarize numeric metrics by category to spot operational differences quickly.</p>
          <PivotBuilder sessionId={sessionId} columnStats={preview.column_stats} />
        </section>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-1">
          {onBack ? (
            <button
              onClick={onBack}
              className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft size={16} /> Back
            </button>
          ) : <div />}

          <button
            onClick={onContinue}
            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-sm transition inline-flex items-center justify-center gap-2"
          >
            Continue to Select Target
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Column inspector */}
      {selectedCol && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setSelectedCol(null)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X size={18} />
            </button>

            <div className="pr-8">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  {colDetail?.type === 'Numeric' ? <Hash size={16} /> : <Type size={16} />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedCol}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Detailed distribution analysis</p>
                </div>
              </div>
            </div>

            {loadingDetail ? (
              <div className="py-20 flex flex-col items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-blue-400" />
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Calculating column statistics...</p>
              </div>
            ) : colDetail ? (
              <div className="space-y-5 mt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <InspectorStat label="Type" value={colDetail.type || 'N/A'} />
                  <InspectorStat label="Non-null" value={formatNumber(colDetail.total_count)} />
                  {colDetail.type === 'Numeric' && (
                    <>
                      <InspectorStat label="Skewness" value={formatNumber(colDetail.skewness, 2)} />
                      <InspectorStat label="IQR Outliers" value={formatNumber(colDetail.outliers_count)} emphasis="amber" />
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {colDetail.type === 'Numeric' ? 'Distribution' : 'Top Categories'}
                    </p>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">{colDetail.type === 'Numeric' ? '10 bins' : 'Top 10 values'}</span>
                  </div>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={colDetail.distribution || []} margin={{ top: 10, right: 20, left: 0, bottom: 35 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                        <XAxis dataKey="bin" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400" interval={0} angle={-20} textAnchor="end" />
                        <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400" />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                          {(colDetail.distribution || []).map((_, index) => <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">Failed to load details for this column.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    violet: 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    cyan: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400',
    rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${tones[tone] || tones.blue}`}>
        <Icon size={16} />
      </div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{value}</p>
    </div>
  );
}

function InsightCard({ label, value, detail, tone = 'blue' }) {
  const accents = {
    blue: 'border-blue-100 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20',
    violet: 'border-violet-100 dark:border-violet-900/50 bg-violet-50/60 dark:bg-violet-950/20',
    emerald: 'border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20',
    amber: 'border-amber-100 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20',
    cyan: 'border-cyan-100 dark:border-cyan-900/50 bg-cyan-50/60 dark:bg-cyan-950/20',
    rose: 'border-rose-100 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20',
  };

  return (
    <div className={`rounded-xl border p-4 ${accents[tone] || accents.blue}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100 truncate" title={String(value)}>{value}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
    >
      <Icon size={13} /> {label}
    </button>
  );
}

function RelationshipControls({ colNames, col1, col2, setCol1, setCol2, onCompare, loading }) {
  return (
    <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
      <select
        value={col1}
        onChange={(e) => setCol1(e.target.value)}
        className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {colNames.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <span className="hidden lg:block text-xs font-semibold text-slate-400 dark:text-slate-500">vs</span>
      <select
        value={col2}
        onChange={(e) => setCol2(e.target.value)}
        className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {colNames.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button
        onClick={onCompare}
        disabled={loading || !col1 || !col2}
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {loading ? 'Analyzing...' : 'Analyze Relationship'}
      </button>
    </div>
  );
}

function ComparisonPanel({ comparison, summary }) {
  return (
    <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{comparison.col1} vs {comparison.col2}</p>
            {summary && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{summary}</p>}
          </div>
          {comparison.chart_type === 'scatter' && comparison.correlation !== undefined && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300">
              Pearson r = {Number(comparison.correlation).toFixed(3)}
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        {comparison.chart_type === 'scatter' && (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                <XAxis dataKey={comparison.col1} name={comparison.col1} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400" />
                <YAxis dataKey={comparison.col2} name={comparison.col2} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400" />
                <Tooltip content={<CustomTooltip />} />
                <Scatter data={comparison.data || []} fill="#3b82f6" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}

        {comparison.chart_type === 'boxplot' && (
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Average numeric value by category</p>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison.data || []} margin={{ top: 10, right: 20, left: 0, bottom: 35 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
                  <XAxis dataKey={Object.keys(comparison.data?.[0] || {})[0]} tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400" />
                  <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey={Object.keys(comparison.data?.[0] || {}).find((k) => k !== Object.keys(comparison.data?.[0] || {})[0]) || 'mean'} fill="#3b82f6" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {comparison.chart_type === 'crosstab' && <CrosstabTable data={comparison.data} col1={comparison.col1} col2={comparison.col2} />}
      </div>
    </div>
  );
}

function EmptyAnalysisState({ title, text }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/20 p-10 text-center">
      <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500">
        <BarChart3 size={18} />
      </div>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-3">{title}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{text}</p>
    </div>
  );
}

function InspectorStat({ label, value, emphasis }) {
  const tone = emphasis === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100';
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30 p-4">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-base font-bold ${tone}`}>{value}</p>
    </div>
  );
}

const CROSSTAB_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1', '#84cc16', '#14b8a6'];

function CrosstabTable({ data, col1, col2 }) {
  const col2Values = Object.keys(data || {});
  const col1Values = col2Values.length > 0 ? Object.keys(data[col2Values[0]] || {}) : [];
  const totalCells = col1Values.length * col2Values.length;

  if (totalCells === 0) {
    return <p className="text-xs text-slate-400 dark:text-slate-500">No data to compare for these columns.</p>;
  }

  if (totalCells > 200) {
    return (
      <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-4">
        Too many unique category combinations to display ({col1Values.length} × {col2Values.length} = {totalCells} cells).
      </div>
    );
  }

  const chartData = col1Values.map((v1) => {
    const row = { name: String(v1) };
    col2Values.forEach((v2) => {
      row[v2] = data[v2]?.[v1] ?? 0;
    });
    return row;
  });

  return (
    <div>
      <div className="h-80 w-full mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 45 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400" interval={0} angle={-25} textAnchor="end" />
            <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-500 dark:text-slate-400" />
            <Tooltip content={<CustomTooltip />} />
            {col2Values.map((v2, i) => <Bar key={v2} dataKey={v2} stackId="a" fill={CROSSTAB_COLORS[i % CROSSTAB_COLORS.length]} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="text-xs w-full border-collapse">
          <thead>
            <tr>
              <th className="p-3 border-b border-slate-200 dark:border-slate-800 text-left font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50">{String(col1)} \ {String(col2)}</th>
              {col2Values.map((v2) => <th key={v2} className="p-3 border-b border-slate-200 dark:border-slate-800 text-right font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/50">{String(v2)}</th>)}
            </tr>
          </thead>
          <tbody>
            {col1Values.map((v1) => (
              <tr key={v1} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="p-3 border-b border-slate-100 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{String(v1)}</td>
                {col2Values.map((v2) => <td key={v2} className="p-3 border-b border-slate-100 dark:border-slate-800 text-right text-slate-600 dark:text-slate-400">{data[v2]?.[v1] ?? 0}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}