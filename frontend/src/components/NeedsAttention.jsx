import { AlertCircle } from 'lucide-react';

// cases shape: [{ caseNumber, subject, caseOwner, daysUntilTarget }, ...]
// daysUntilTarget negative = already overdue
function NeedsAttention({ cases }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Needs Attention</h3>
      <div className="space-y-3">
        {cases.map((c) => {
          const overdue = c.daysUntilTarget < 0;
          return (
            <div key={c.caseNumber} className="flex items-center gap-3 border-b border-gray-50 pb-3 last:border-0 last:pb-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${overdue ? 'bg-red-50' : 'bg-amber-50'}`}>
                <AlertCircle size={16} className={overdue ? 'text-red-500' : 'text-amber-500'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{c.subject}</p>
                <p className="text-xs text-gray-400">Owner: {c.caseOwner}</p>
              </div>
              <span className={`text-xs font-semibold flex-shrink-0 ${overdue ? 'text-red-500' : 'text-amber-600'}`}>
                {overdue ? `${Math.abs(c.daysUntilTarget)}d overdue` : `${c.daysUntilTarget}d left`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NeedsAttention;