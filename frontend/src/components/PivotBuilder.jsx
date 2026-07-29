import React, { useState } from 'react';
import { getPivotData } from '../api';

export default function PivotBuilder({ sessionId, columnStats }) {
  // Extract categorical and numeric columns from session stats
  const catCols = columnStats?.filter(c => c.type === 'Categorical').map(c => c.name) || [];
  const numCols = columnStats?.filter(c => c.type === 'Numeric').map(c => c.name) || [];

  const [catCol, setCatCol] = useState('');
  const [numCol, setNumCol] = useState('');
  const [aggFunc, setAggFunc] = useState('mean');
  const [pivotData, setPivotData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeCat = catCol || catCols[0] || '';
  const activeNum = numCol || numCols[0] || '';

  const handleRunPivot = async () => {
    if (!activeCat || !activeNum) {
      setError("Please select both a categorical and a numeric column.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getPivotData(sessionId, activeCat, activeNum, aggFunc);
      setPivotData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-5 bg-slate-800/80 backdrop-blur rounded-xl border border-slate-700 shadow-lg mt-6 text-white">
      <div className="mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <span>📊</span> No-Code Data Aggregator
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">Group metrics across categories without writing SQL or Pandas code.</p>
      </div>

      {/* Control Panel */}
      <div className="flex flex-wrap gap-4 items-end mb-4 bg-slate-900/60 p-3.5 rounded-lg border border-slate-700/50">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Group By (Category)</label>
          <select 
            value={activeCat} 
            onChange={(e) => setCatCol(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {catCols.length > 0 ? (
              catCols.map(col => <option key={col} value={col}>{col}</option>)
            ) : (
              <option value="">No categorical columns available</option>
            )}
          </select>
        </div>

        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Target Metric (Numeric)</label>
          <select 
            value={activeNum} 
            onChange={(e) => setNumCol(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            {numCols.length > 0 ? (
              numCols.map(col => <option key={col} value={col}>{col}</option>)
            ) : (
              <option value="">No numeric columns available</option>
            )}
          </select>
        </div>

        <div className="w-36">
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Aggregation</label>
          <select 
            value={aggFunc} 
            onChange={(e) => setAggFunc(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="mean">Mean (Average)</option>
            <option value="sum">Sum</option>
            <option value="count">Count</option>
            <option value="min">Min</option>
            <option value="max">Max</option>
          </select>
        </div>

        <button 
          onClick={handleRunPivot}
          disabled={loading || catCols.length === 0 || numCols.length === 0}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 h-[38px] flex items-center justify-center gap-2"
        >
          {loading ? 'Calculating...' : 'Run Query'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-red-300 text-xs mb-4">
          {error}
        </div>
      )}

      {/* Aggregation Results Table */}
      {pivotData && (
        <div className="overflow-hidden border border-slate-700/80 rounded-lg mt-4 bg-slate-900/40">
          <table className="w-full text-left text-sm text-slate-200">
            <thead className="bg-slate-900/90 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-700">
              <tr>
                <th className="px-4 py-2.5 font-semibold">{activeCat}</th>
                <th className="px-4 py-2.5 font-semibold">{aggFunc.toUpperCase()} of {activeNum}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {pivotData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="px-4 py-2 font-medium text-slate-300">{String(row.category)}</td>
                  <td className="px-4 py-2 font-mono text-blue-400 font-semibold">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}