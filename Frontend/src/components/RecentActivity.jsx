import { FileText } from 'lucide-react';

const STATUS_STYLES = {
  Open: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50',
  Pending: 'text-fuchsia-600 dark:text-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-950/50',
  Closed: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50',
  Escalated: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50',
};

function RecentActivity({ cases }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 p-5 transition-colors">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {cases.map((c) => (
          <div key={c.caseNumber} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
              <FileText size={16} className="text-slate-400 dark:text-slate-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{c.subject}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">{c.contactName} · {c.dateOpen}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${STATUS_STYLES[c.status] || 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800'}`}>
              {c.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RecentActivity;