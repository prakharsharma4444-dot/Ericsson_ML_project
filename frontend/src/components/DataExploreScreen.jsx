import { useState, useEffect } from 'react';
import { 
  ScatterChart, Scatter, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { AlertTriangle, ShieldCheck, Hash, Type, X, Search, Download, ArrowLeft } from 'lucide-react';
import { getPreview, compareColumns, getColumnDetail, getReportUrl } from "../api";
import PivotBuilder from "./PivotBuilder";

export default function DataExploreScreen({ sessionId, columns, onContinue, onBack }) {
  const [preview, setPreview] = useState(null);
  const colNames = columns.map(c => (typeof c === 'object' ? c.name : c));
  const [col1, setCol1] = useState(colNames[0] || '');
  const [col2, setCol2] = useState(colNames[1] || colNames[0] || '');
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('profiling');

  // Table Search State
  const [searchTerm, setSearchTerm] = useState('');

  // Column Inspector Modal State
  const [selectedCol, setSelectedCol] = useState(null);
  const [colDetail, setColDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 15;

  useEffect(() => {
    getPreview(sessionId)
      .then(setPreview)
      .catch(err => setError(err.message));
  }, [sessionId]);

  const handleInspectColumn = async (colName) => {
    setSelectedCol(colName);
    setLoadingDetail(true);
    setColDetail(null);
    try {
      const data = await getColumnDetail(sessionId, colName);
      setColDetail(data);
    } catch (err) {
      console.error(err);
    }
    setLoadingDetail(false);
  };

  const handleCompare = async () => {
    setLoading(true);
    setError(null);
    try {
      setComparison(await compareColumns(sessionId, col1, col2));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleExportStats = () => {
    if (!preview?.column_stats) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(preview.column_stats, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", jsonString);
    downloadAnchor.setAttribute("download", `dataset_summary_${sessionId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtered raw table rows
  const rawRows = preview?.preview || [];
  const filteredRows = rawRows.filter(row =>
    Object.values(row).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const totalRows = filteredRows.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const displayedRows = filteredRows.slice(startIndex, startIndex + rowsPerPage);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Header with Back Button and Quick Actions */}
      <div>
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 transition mb-3"
          >
            <ArrowLeft size={14} /> Back to Previous Step
          </button>
        )}

        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Dataset Profiling & Exploration</h2>
            <p className="text-xs text-gray-500 mt-1">Deep inspection of structure, column health, and distributions</p>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportStats}
              disabled={!preview?.column_stats}
              className="flex items-center gap-1.5 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-xs font-medium transition shadow-sm disabled:opacity-50"
            >
              <Download size={14} />
              <span>Export Summary</span>
            </button>

            <button
              onClick={() => window.open(getReportUrl(sessionId), '_blank')}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition shadow-sm"
            >
              <span>📑</span>
              <span>Interactive Profiling Report</span>
            </button>
          </div>
        </div>
      </div>

      {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

      {preview && (
        <>
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox label="Total Rows" value={preview.n_rows?.toLocaleString()} />
            <StatBox label="Total Features" value={preview.n_cols} />
            <StatBox label="Missing Values" value={preview.missing_values?.toLocaleString()} />
            <StatBox label="Numeric Columns" value={preview.numeric_features} />
          </div>

          {/* Quality Warnings Banner */}
          {preview.alerts && preview.alerts.length > 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-3">
                <AlertTriangle size={18} className="text-amber-600" />
                Data Quality Warnings & Diagnostics ({preview.alerts.length})
              </div>
              <ul className="space-y-1.5 text-xs text-amber-900 list-disc pl-5">
                {preview.alerts.map((alert, idx) => (
                  <li key={idx}>{alert}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm flex items-center gap-3 text-green-800 text-xs font-medium">
              <ShieldCheck size={20} className="text-green-600" />
              Dataset passed initial health checks. Minimal missingness and balanced variance detected.
            </div>
          )}

          {/* Tabbed Section */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex border-b border-gray-100 mb-4 pb-2 gap-4 justify-between items-center flex-wrap">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('profiling')}
                  className={`text-sm font-semibold pb-2 border-b-2 transition-all ${
                    activeTab === 'profiling' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Column Health & Summary Stats
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`text-sm font-semibold pb-2 border-b-2 transition-all ${
                    activeTab === 'preview' 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Raw Data Table Preview
                </button>
              </div>

              {/* Raw Table Filter Search Bar */}
              {activeTab === 'preview' && (
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search rows..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-48"
                  />
                </div>
              )}
            </div>

            {/* TAB 1: Column Profiling Table */}
            {activeTab === 'profiling' && preview.column_stats && (
              <div className="overflow-x-auto">
                <table className="text-xs w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 font-medium">
                      <th className="p-2.5">Feature Name</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5">Missingness</th>
                      <th className="p-2.5">Unique Values</th>
                      <th className="p-2.5">Min / Max</th>
                      <th className="p-2.5">Mean / Median</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.column_stats.map((col, idx) => (
                      <tr 
                        key={idx} 
                        onClick={() => handleInspectColumn(col.name)}
                        className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                      >
                        <td className="p-2.5 font-semibold text-gray-800 flex items-center gap-1.5">
                          {col.name}
                        </td>
                        <td className="p-2.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium text-[11px] ${
                            col.type === 'Numeric' 
                              ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                              : 'bg-purple-50 text-purple-700 border border-purple-100'
                          }`}>
                            {col.type === 'Numeric' ? <Hash size={12} /> : <Type size={12} />}
                            {col.type}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${col.missing_pct > 20 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min(col.missing_pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-gray-600 font-medium">{col.missing_pct}%</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-gray-700">{col.unique_count?.toLocaleString()}</td>
                        <td className="p-2.5 text-gray-600">
                          {col.type === 'Numeric' && col.min !== undefined ? `${col.min} → ${col.max}` : '-'}
                        </td>
                        <td className="p-2.5 text-gray-600">
                          {col.type === 'Numeric' && col.mean !== undefined ? `${col.mean} (med: ${col.median})` : '-'}
                        </td>
                        <td className="p-2.5 text-right">
                          <button className="text-xs text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-auto">
                            <Search size={12} /> Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* TAB 2: Raw Preview */}
            {activeTab === 'preview' && (
              <div>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr>
                        {preview.preview[0] && Object.keys(preview.preview[0]).map(col => (
                          <th key={col} className="text-left p-2 border-b font-semibold text-gray-600 whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedRows.length > 0 ? (
                        displayedRows.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50 transition-colors">
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="p-2 border-b text-gray-600 whitespace-nowrap">{String(val)}</td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={100} className="p-6 text-center text-gray-400 text-xs">
                            No rows matching "{searchTerm}"
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {totalRows > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t border-gray-100 gap-4">
                    <span className="text-xs text-gray-500 font-medium">
                      Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, totalRows)} of {totalRows} rows
                    </span>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg">
                          Page {currentPage} of {totalPages}
                        </span>
                        <button 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pivot Builder Component */}
          <PivotBuilder
            sessionId={sessionId}
            columnStats={preview.column_stats}
          />
        </>
      )}

      {/* Column Pairwise Visual Comparison Section */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Pairwise Relationship Visualizer</h3>
        <p className="text-xs text-gray-500 mb-4">Select any two columns to plot interactions and scatter spreads</p>

        <div className="flex flex-wrap gap-3 items-center mb-6">
          <select value={col1} onChange={e => setCol1(e.target.value)} className="border border-gray-200 rounded-lg p-2 text-xs bg-gray-50 focus:bg-white focus:outline-none">
            {colNames.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-gray-400 font-medium text-xs">vs</span>
          <select value={col2} onChange={e => setCol2(e.target.value)} className="border border-gray-200 rounded-lg p-2 text-xs bg-gray-50 focus:bg-white focus:outline-none">
            {colNames.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={handleCompare} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors hover:bg-blue-700 shadow-sm">
            {loading ? 'Plotting...' : 'Plot Comparison'}
          </button>
        </div>

        {comparison?.chart_type === 'scatter' && (
          <div>
            {comparison.correlation !== undefined && (
              <p className="text-xs font-medium text-gray-600 mb-3">
                Pearson Correlation ($r$): <span className="text-blue-600 font-bold">{comparison.correlation?.toFixed(3)}</span>
              </p>
            )}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey={comparison.col1} name={comparison.col1} tick={{ fontSize: 11 }} />
                  <YAxis dataKey={comparison.col2} name={comparison.col2} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Scatter data={comparison.data} fill="#3b82f6" fillOpacity={0.6} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {comparison?.chart_type === 'boxplot' && (
          <div>
            <p className="text-xs text-gray-500 mb-3 font-medium">Group Mean Comparison</p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison.data} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey={Object.keys(comparison.data[0] || {})[0]} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar 
                    dataKey={Object.keys(comparison.data[0] || {}).find(k => k !== Object.keys(comparison.data[0] || {})[0]) || 'mean'} 
                    fill="#2563eb" 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {comparison?.chart_type === 'crosstab' && (
          <CrosstabTable data={comparison.data} col1={comparison.col1} col2={comparison.col2} />
        )}
      </div>

      {/* Navigation Footer with Back and Continue Buttons */}
      <div className="flex items-center justify-between pt-4">
        {onBack ? (
          <button
            onClick={onBack}
            className="px-5 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-xl text-sm font-medium transition flex items-center gap-2"
          >
            <ArrowLeft size={16} /> Back
          </button>
        ) : <div />}

        <button
          onClick={onContinue}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-sm transition flex items-center gap-2"
        >
          Continue to Select Target 
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </button>
      </div>

      {/* SINGLE COLUMN INSPECTOR MODAL */}
      {selectedCol && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button 
              onClick={() => setSelectedCol(null)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-gray-800">Column Inspector: {selectedCol}</h3>
            </div>
            <p className="text-xs text-gray-500 mb-5">Full dataset distribution analysis</p>

            {loadingDetail ? (
              <div className="py-16 text-center text-sm text-gray-500">Calculating dataset distribution...</div>
            ) : colDetail ? (
              <div className="space-y-5">
                {colDetail.type === 'Numeric' && (
                  <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 text-center">
                    <div>
                      <p className="text-[11px] text-gray-500 font-medium">Skewness</p>
                      <p className="text-sm font-bold text-gray-800">{colDetail.skewness}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500 font-medium">IQR Outliers</p>
                      <p className="text-sm font-bold text-amber-600">{colDetail.outliers_count}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-500 font-medium">Non-Null Sample</p>
                      <p className="text-sm font-bold text-gray-800">{colDetail.total_count?.toLocaleString()}</p>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-3">
                    {colDetail.type === 'Numeric' ? 'Value Histogram (10 Bins)' : 'Top 10 Categorical Frequencies'}
                  </p>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={colDetail.distribution} margin={{ top: 10, right: 20, left: 0, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="bin" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-red-500">Failed to load details for this column.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col justify-center">
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-800">{value ?? 'N/A'}</p>
    </div>
  );
}

// Renders a categorical-vs-categorical comparison as a stacked bar chart
// plus a count table. Backend sends data shaped as
// { col2Value: { col1Value: count } }. Caps rendering when combined
// cardinality is too large to be useful (common when one picked column
// is ID-like, e.g. "case number").
const CROSSTAB_COLORS = ['#3b82f6', '#22c3a6', '#f472b6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#ec4899', '#6366f1'];

function CrosstabTable({ data, col1, col2 }) {
  const col2Values = Object.keys(data || {});
  const col1Values = col2Values.length > 0 ? Object.keys(data[col2Values[0]] || {}) : [];
  const totalCells = col1Values.length * col2Values.length;

  if (totalCells === 0) {
    return <p className="text-xs text-gray-400">No data to compare for these columns.</p>;
  }

  if (totalCells > 200) {
    return (
      <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4">
        Too many unique category combinations to display
        ({col1Values.length} × {col2Values.length} = {totalCells} cells). This usually means
        one of the selected columns (like an ID column) has too many unique values.
        Try picking two columns with fewer distinct categories.
      </div>
    );
  }

  // Reshape into recharts-friendly rows: one row per col1 value, one
  // stacked bar segment per col2 value.
  const chartData = col1Values.map((v1) => {
    const row = { name: v1 };
    col2Values.forEach((v2) => {
      row[v2] = data[v2]?.[v1] ?? 0;
    });
    return row;
  });

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3 font-medium">
        {col1} by {col2}
      </p>
      <div className="h-72 w-full mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            {col2Values.map((v2, i) => (
              <Bar key={v2} dataKey={v2} stackId="a" fill={CROSSTAB_COLORS[i % CROSSTAB_COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="text-xs w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 border-b border-gray-200 text-left font-semibold text-gray-600 bg-gray-50">
                {col1} \ {col2}
              </th>
              {col2Values.map((v2) => (
                <th key={v2} className="p-2 border-b border-gray-200 text-right font-semibold text-gray-600 bg-gray-50">
                  {v2}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {col1Values.map((v1) => (
              <tr key={v1} className="hover:bg-gray-50">
                <td className="p-2 border-b border-gray-100 font-medium text-gray-700 whitespace-nowrap">{v1}</td>
                {col2Values.map((v2) => (
                  <td key={v2} className="p-2 border-b border-gray-100 text-right text-gray-600">
                    {data[v2]?.[v1] ?? 0}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}