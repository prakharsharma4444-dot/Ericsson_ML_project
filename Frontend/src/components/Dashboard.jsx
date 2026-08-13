import { useState } from 'react';
import {
  FolderOpen,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Download,
  Sparkles,
  AlertCircle,
  X,
  FileText,
  User,
  Calendar,
  Tag,
  SearchX,
  Filter
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import StatCard from './StatCard';

const PRIORITY_COLORS = { Overdue: '#DC2626', Pending: '#2563EB', Closed: '#16A34A', Open: '#3B82F6' };

const defaultSummary = {
  openCases: 142, openCasesTrend: -12,
  overdueCases: 28, overdueCasesTrend: 4,
  avgResolutionHours: 4.2, avgResolutionTrend: -1.5,
  slaCompliancePct: 94, slaComplianceTrend: 2,
};

const defaultStatusData = [
  { day: 'Sat', thisWeek: 320, lastWeek: 210 },
  { day: 'Sun', thisWeek: 250, lastWeek: 180 },
  { day: 'Mon', thisWeek: 280, lastWeek: 200 },
  { day: 'Tue', thisWeek: 340, lastWeek: 380 },
  { day: 'Wed', thisWeek: 160, lastWeek: 230 },
  { day: 'Thu', thisWeek: 300, lastWeek: 240 },
  { day: 'Fri', thisWeek: 280, lastWeek: 260 },
];

const defaultPriorityData = [
  { name: 'Overdue', value: 45 },
  { name: 'Pending', value: 120 },
  { name: 'Closed', value: 90 },
  { name: 'Open', value: 90 },
];

const defaultRecent = [
  { caseId: 'CAS-9091', subject: 'Network Connectivity Failure in Node B', status: 'In Progress', priority: 'High', dateOpen: '2026-03-10', solutionTarget: '2026-03-12', contactName: 'John Doe', caseOwner: 'Alice Smith', desc: 'Node lost connectivity following scheduled maintenance.', lastUpdated: '10 mins ago' },
  { caseId: 'CAS-9088', subject: 'Authentication Timeout Error', status: 'Closed', priority: 'Medium', dateOpen: '2026-03-09', solutionTarget: '2026-03-10', contactName: 'Jane Smith', caseOwner: 'Bob Johnson', desc: 'Users experiencing intermittent login timeouts.', lastUpdated: '1 hour ago' },
];

const defaultAttention = [
  { caseId: 'CAS-8902', issue: 'Overdue by 3d', subject: 'Database Replication Lag', status: 'Open', priority: 'Critical', dateOpen: '2026-03-01', solutionTarget: '2026-03-05', contactName: 'Robert Vance', caseOwner: 'Unassigned', desc: 'Primary DB replica lagging by over 45 minutes.' },
  { caseId: 'CAS-8877', issue: 'SLA Target due today', subject: 'Gateway Buffer Overflow', status: 'Open', priority: 'High', dateOpen: '2026-03-04', solutionTarget: '2026-03-08', contactName: 'Elena Rostova', caseOwner: 'Charlie Brown', desc: 'Packet drop rate spiked to 12% on gateway alpha.' },
];

const STATUS_PILL = {
  'In Progress': 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  Closed: 'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400',
  Open: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400',
  Pending: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400',
};

function Dashboard({
  summary = {},
  statusData = [],
  priorityData = [],
  recentCases = [],
  attentionCases = [],
  searchQuery = '',
  onClearSearch,
  onExportReport,
  onMakePrediction,
}) {
  const [selectedCaseModal, setSelectedCaseModal] = useState(null);

  const openCases = summary?.openCases ?? summary?.open_cases ?? defaultSummary.openCases;
  const overdueCases = summary?.overdueCases ?? summary?.overdue_cases ?? defaultSummary.overdueCases;
  const avgHours = summary?.avgResolutionHours ?? summary?.avg_resolution_hours ?? summary?.avgResolutionTime ?? defaultSummary.avgResolutionHours;
  const slaPct = summary?.slaCompliancePct ?? summary?.sla_compliance_pct ?? defaultSummary.slaCompliancePct;

  const openTrend = summary?.openCasesTrend ?? summary?.open_cases_trend ?? defaultSummary.openCasesTrend;
  const overdueTrend = summary?.overdueCasesTrend ?? summary?.overdue_cases_trend ?? defaultSummary.overdueCasesTrend;
  const avgTrend = summary?.avgResolutionTrend ?? summary?.avg_resolution_trend ?? defaultSummary.avgResolutionTrend;
  const slaTrend = summary?.slaComplianceTrend ?? summary?.sla_compliance_trend ?? defaultSummary.slaComplianceTrend;

  const safeStatusData = Array.isArray(statusData) && statusData.length > 0 ? statusData : defaultStatusData;
  const safePriorityData = Array.isArray(priorityData) && priorityData.length > 0 ? priorityData : defaultPriorityData;
  const safeRecent = Array.isArray(recentCases) && recentCases.length > 0 ? recentCases : defaultRecent;
  const safeAttention = Array.isArray(attentionCases) && attentionCases.length > 0 ? attentionCases : defaultAttention;

  const matchesSearch = (item, q) => {
    if (!q || !q.trim()) return true;
    const term = q.toLowerCase().trim();
    return (
      (item.caseId && item.caseId.toLowerCase().includes(term)) ||
      (item.subject && item.subject.toLowerCase().includes(term)) ||
      (item.status && item.status.toLowerCase().includes(term)) ||
      (item.priority && item.priority.toLowerCase().includes(term)) ||
      (item.contactName && item.contactName.toLowerCase().includes(term)) ||
      (item.caseOwner && item.caseOwner.toLowerCase().includes(term)) ||
      (item.desc && item.desc.toLowerCase().includes(term)) ||
      (item.issue && item.issue.toLowerCase().includes(term))
    );
  };

  const filteredRecent = safeRecent.filter((c) => matchesSearch(c, searchQuery));
  const filteredAttention = safeAttention.filter((c) => matchesSearch(c, searchQuery));

  return (
    <div className="space-y-6 relative">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Overview</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Real-time metrics for precision analytics.</p>
        </div>
        <button
          onClick={onExportReport}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition"
        >
          <Download size={16} />
          Export Report
        </button>
      </div>

      {searchQuery && (
        <div className="flex items-center justify-between bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60 rounded-xl px-4 py-2.5 text-xs text-blue-900 dark:text-blue-200">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-blue-600 dark:text-blue-400" />
            <span>
              Filtering cases matching: <strong className="font-semibold text-blue-950 dark:text-blue-100">"{searchQuery}"</strong>
            </span>
          </div>
          <button
            onClick={onClearSearch}
            className="flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-200 transition"
          >
            Clear Filter <X size={12} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Cases" value={openCases} icon={FolderOpen} iconBg="bg-blue-50 dark:bg-blue-950/50" iconColor="text-blue-600 dark:text-blue-400" trend={openTrend} trendGood={false} />
        <StatCard label="Overdue Cases" value={overdueCases} icon={AlertTriangle} iconBg="bg-red-50 dark:bg-red-950/50" iconColor="text-red-500 dark:text-red-400" trend={overdueTrend} trendGood={false} />
        <StatCard label="Avg Resolution Time" value={`${avgHours}h`} icon={Clock} iconBg="bg-blue-50 dark:bg-blue-950/50" iconColor="text-blue-600 dark:text-blue-400" trend={avgTrend} trendGood={false} trendLabel="vs last week (h)" />
        <StatCard label="SLA Compliance" value={`${slaPct}%`} icon={CheckCircle2} iconBg="bg-green-50 dark:bg-green-950/50" iconColor="text-green-600 dark:text-green-400" trend={slaTrend} trendGood={true} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Case Status Breakdown</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeStatusData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94A3B8" strokeOpacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="lastWeek" name="Last week" fill="#CBD5E1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="thisWeek" name="This week" fill="#2563EB" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Case Priority Distribution</h3>
          <div className="flex items-center gap-6">
            <div className="h-56 w-40 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={safePriorityData} dataKey="value" nameKey="name" innerRadius={0} outerRadius={75} paddingAngle={2}>
                    {safePriorityData.map((entry) => (
                      <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] || '#94A3B8'} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} cases`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2.5 flex-1">
              {safePriorityData.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[entry.name] || '#94A3B8' }} />
                    <span className="text-slate-600 dark:text-slate-400">{entry.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Recent Activity (n-1 Date)</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500">Click row for raw info</span>
          </div>

          {filteredRecent.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <SearchX size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No matching recent activity found.</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 dark:text-slate-500 text-left border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-2 font-medium">Case ID</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecent.map((c, i) => (
                  <tr
                    key={c.caseId || i}
                    onClick={() => setSelectedCaseModal(c)}
                    className="border-b border-slate-50 dark:border-slate-800/60 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition"
                  >
                    <td className="py-2.5 font-medium text-blue-600 dark:text-blue-400">#{c.caseId}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_PILL[c.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-slate-400 dark:text-slate-500">{c.lastUpdated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm p-5 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500 dark:text-red-400" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Needs Attention (Open Only)</h3>
            </div>
            {filteredAttention.length > 0 && (
              <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-full">
                {filteredAttention.length} Urgent
              </span>
            )}
          </div>

          {filteredAttention.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <SearchX size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No urgent tickets match your filter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAttention.map((c, i) => (
                <div
                  key={c.caseId || i}
                  onClick={() => setSelectedCaseModal(c)}
                  className="flex items-center justify-between text-xs p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 cursor-pointer transition group"
                >
                  <div>
                    <p className="font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">#{c.caseId}</p>
                    <p className="text-red-500 dark:text-red-400 mt-0.5 font-medium">{c.issue}</p>
                  </div>
                  <span className="text-slate-400 dark:text-slate-500 text-[11px] group-hover:text-blue-600 dark:group-hover:text-blue-400 font-medium">
                    View Raw Info &rarr;
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center pt-2">
        <button
          onClick={onMakePrediction}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-sm transition"
        >
          <Sparkles size={16} />
          Make Prediction with AI
        </button>
      </div>

      {selectedCaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in duration-150">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Case #{selectedCaseModal.caseId}</h3>
                  {selectedCaseModal.issue && (
                    <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-100 dark:border-red-900/50 px-2.5 py-0.5 rounded-full">
                      {selectedCaseModal.issue}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedCaseModal.subject || 'No Subject Provided'}</p>
              </div>
              <button
                onClick={() => setSelectedCaseModal(null)}
                className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(90vh-130px)]">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-400 mb-1">
                    <Tag size={13} />
                    <span className="font-medium">Status</span>
                  </div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{selectedCaseModal.status || 'N/A'}</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-400 mb-1">
                    <AlertTriangle size={13} />
                    <span className="font-medium">Priority</span>
                  </div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{selectedCaseModal.priority || 'N/A'}</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-400 mb-1">
                    <Calendar size={13} />
                    <span className="font-medium">Date Open</span>
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{selectedCaseModal.dateOpen || 'N/A'}</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-400 mb-1">
                    <Clock size={13} />
                    <span className="font-medium">Solution Target</span>
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{selectedCaseModal.solutionTarget || 'N/A'}</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-400 mb-1">
                    <User size={13} />
                    <span className="font-medium">Contact Name</span>
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{selectedCaseModal.contactName || 'N/A'}</span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-400 mb-1">
                    <User size={13} />
                    <span className="font-medium">Case Owner</span>
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{selectedCaseModal.caseOwner || 'N/A'}</span>
                </div>
              </div>

              {selectedCaseModal.desc && (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-400 mb-1.5">
                    <FileText size={13} />
                    <span className="font-medium">Raw Description</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{selectedCaseModal.desc}</p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end bg-slate-50/50 dark:bg-slate-800/50">
              <button
                onClick={() => setSelectedCaseModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg shadow-sm transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;