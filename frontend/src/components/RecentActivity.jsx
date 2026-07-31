import { FileText } from 'lucide-react';

const STATUS_STYLES = {
  Open: 'text-indigo-600 bg-indigo-50',
  Pending: 'text-fuchsia-600 bg-fuchsia-50',
  Closed: 'text-green-600 bg-green-50',
  Escalated: 'text-red-600 bg-red-50',
};

// cases shape: [{ caseNumber, subject, contactName, status, dateOpen }, ...]
function RecentActivity({ cases }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</h3>
      <div className="space-y-4">
        {cases.map((c) => (
          <div key={c.caseNumber} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
              <FileText size={16} className="text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{c.subject}</p>
              <p className="text-xs text-gray-400">{c.contactName} · {c.dateOpen}</p>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${STATUS_STYLES[c.status] || 'text-gray-500 bg-gray-50'}`}>
              {c.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RecentActivity;