import { useState, useEffect } from 'react';
import { CheckCircle2, Database, Trash2 } from 'lucide-react';

function HistoryScreen({ theme }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('ml_history') || '[]');
    setHistory(saved);
  }, []);

  const handleClearHistory = () => {
    localStorage.removeItem('ml_history');
    setHistory([]);
  };

  const isDark = theme === 'dark';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Analysis History
          </h2>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Review past ML pipeline executions recorded locally.
          </p>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/10 transition"
          >
            <Trash2 size={14} /> Clear History
          </button>
        )}
      </div>

      <div className={`rounded-2xl border shadow-sm overflow-hidden ${
        isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
      }`}>
        {history.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium">
            No analysis runs recorded yet. Upload a dataset and train a model to see history here!
          </div>
        ) : (
          <table className="w-full text-xs text-left">
            <thead className={`font-semibold border-b ${
              isDark ? 'bg-slate-900/50 text-slate-400 border-slate-700' : 'bg-slate-50/70 text-slate-400 border-slate-100'
            }`}>
              <tr>
                <th className="p-4">Run ID</th>
                <th className="p-4">Dataset</th>
                <th className="p-4">Target Column</th>
                <th className="p-4">Best Model</th>
                <th className="p-4">Metric</th>
                <th className="p-4">Executed</th>
                <th className="p-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className={`divide-y font-medium ${
              isDark ? 'divide-slate-700/50 text-slate-300' : 'divide-slate-100 text-slate-700'
            }`}>
              {history.map((run) => (
                <tr key={run.id} className={isDark ? 'hover:bg-slate-700/30 transition' : 'hover:bg-slate-50/80 transition'}>
                  <td className="p-4 font-mono text-blue-400 font-semibold">{run.id}</td>
                  <td className={`p-4 flex items-center gap-2 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    <Database size={14} className="text-slate-400" />
                    {run.dataset}
                  </td>
                  <td className="p-4 font-mono text-slate-400">{run.target}</td>
                  <td className="p-4">{run.model}</td>
                  <td className="p-4 font-semibold text-emerald-500">{run.accuracy}</td>
                  <td className="p-4 text-slate-400">{run.date}</td>
                  <td className="p-4 text-right">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500">
                      <CheckCircle2 size={12} />
                      {run.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default HistoryScreen;