import React, { useState } from 'react';
import { AlertCircle, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

function NeedsAttention({ cases = [], onSelectCase, itemsPerPage = 5 }) {
  const safeCases = Array.isArray(cases) ? cases : [];
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(safeCases.length / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCases = safeCases.slice(startIndex, startIndex + itemsPerPage);

  const handlePrev = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleNext = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-red-500" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Needs Attention</h3>
          </div>
          {safeCases.length > 0 && (
            <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900/50 px-2.5 py-0.5 rounded-full">
              {safeCases.length} Urgent
            </span>
          )}
        </div>

        {safeCases.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
            No urgent items requiring attention.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Case ID</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3 text-right">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 bg-white dark:bg-slate-900">
                {paginatedCases.map((c, index) => (
                  <tr
                    key={c.caseId || index}
                    onClick={() => onSelectCase && onSelectCase(c)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-3 font-semibold text-blue-600 dark:text-blue-400 align-middle whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>#{c.caseId}</span>
                        {c.issue && (
                          <span className="text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/80 border border-red-200 dark:border-red-900/50 px-1.5 py-0.5 rounded">
                            {c.issue}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 align-middle max-w-[180px] truncate">
                      {c.subject || c.desc || 'No subject provided'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-500 dark:text-slate-400 align-middle whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{c.priority}</span>
                        <ArrowRight size={14} className="text-slate-400 dark:text-slate-500" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {safeCases.length > itemsPerPage && (
        <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, safeCases.length)} of {safeCases.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 font-medium">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default NeedsAttention;