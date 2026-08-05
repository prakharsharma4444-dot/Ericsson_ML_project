import { FolderOpen, AlertTriangle, Clock, CheckCircle2, Download, Sparkles, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import StatCard from './StatCard';

const PRIORITY_COLORS = { Overdue: '#DC2626', Pending: '#2563EB', Closed: '#16A34A', Open: '#0B2D5B' };

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
  { caseId: '#CAS-9091', subject: 'Case #9091', status: 'In Progress', lastUpdated: '10 mins ago' },
  { caseId: '#CAS-9088', subject: 'Case #9088', status: 'Resolved', lastUpdated: '1 hour ago' },
  { caseId: '#CAS-9085', subject: 'Case #9085', status: 'In Progress', lastUpdated: '2 hours ago' },
  { caseId: '#CAS-9070', subject: 'Case #9070', status: 'New', lastUpdated: '4 hours ago' },
];

const defaultAttention = [
  { caseId: '#CAS-8902', issue: 'SLA Breach Warning' },
  { caseId: '#CAS-8877', issue: 'Client Escalation' },
  { caseId: '#CAS-8810', issue: 'Overdue > 48h' },
];

const STATUS_PILL = {
  'In Progress': 'bg-slate-100 text-slate-600',
  Resolved: 'bg-green-50 text-green-700',
  New: 'bg-slate-100 text-slate-600',
};

function Dashboard({
  summary = {},
  statusData = [],
  priorityData = [],
  recentCases = [],
  attentionCases = [],
  onExportReport,
  onMakePrediction,
}) {
  // Safe extraction supporting snake_case, camelCase, and fallbacks
  const openCases = summary?.openCases ?? summary?.open_cases ?? defaultSummary.openCases;
  const overdueCases = summary?.overdueCases ?? summary?.overdue_cases ?? defaultSummary.overdueCases;
  const avgHours = summary?.avgResolutionHours ?? summary?.avg_resolution_hours ?? summary?.avgResolutionTime ?? defaultSummary.avgResolutionHours;
  const slaPct = summary?.slaCompliancePct ?? summary?.sla_compliance_pct ?? defaultSummary.slaCompliancePct;

  const openTrend = summary?.openCasesTrend ?? summary?.open_cases_trend ?? defaultSummary.openCasesTrend;
  const overdueTrend = summary?.overdueCasesTrend ?? summary?.overdue_cases_trend ?? defaultSummary.overdueCasesTrend;
  const avgTrend = summary?.avgResolutionTrend ?? summary?.avg_resolution_trend ?? defaultSummary.avgResolutionTrend;
  const slaTrend = summary?.slaComplianceTrend ?? summary?.sla_compliance_trend ?? defaultSummary.slaComplianceTrend;

  // Safe chart data arrays
  const safeStatusData = Array.isArray(statusData) && statusData.length > 0 ? statusData : defaultStatusData;
  const safePriorityData = Array.isArray(priorityData) && priorityData.length > 0 ? priorityData : defaultPriorityData;
  const safeRecent = Array.isArray(recentCases) && recentCases.length > 0 ? recentCases : defaultRecent;
  const safeAttention = Array.isArray(attentionCases) && attentionCases.length > 0 ? attentionCases : defaultAttention;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Overview</h2>
          <p className="text-sm text-slate-500 mt-0.5">Real-time metrics for precision analytics.</p>
        </div>
        <button
          onClick={onExportReport}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm transition"
        >
          <Download size={16} />
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open Cases" value={openCases} icon={FolderOpen} iconBg="bg-blue-50" iconColor="text-blue-600" trend={openTrend} trendGood={false} />
        <StatCard label="Overdue Cases" value={overdueCases} icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-500" trend={overdueTrend} trendGood={false} />
        <StatCard label="Avg Resolution Time" value={`${avgHours}h`} icon={Clock} iconBg="bg-blue-50" iconColor="text-blue-600" trend={avgTrend} trendGood={false} trendLabel="vs last week (h)" />
        <StatCard label="SLA Compliance" value={`${slaPct}%`} icon={CheckCircle2} iconBg="bg-green-50" iconColor="text-green-600" trend={slaTrend} trendGood={true} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Case Status Breakdown</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeStatusData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="lastWeek" name="Last week" fill="#CBD5E1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="thisWeek" name="This week" fill="#2563EB" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Case Priority Distribution</h3>
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
                    <span className="text-slate-600">{entry.name}</span>
                  </div>
                  <span className="font-semibold text-slate-800">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Recent Activity</h3>
            <button className="text-xs font-medium text-blue-600 hover:underline">View All</button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 text-left border-b border-slate-100">
                <th className="pb-2 font-medium">Case ID</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium text-right">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {safeRecent.map((c, i) => (
                <tr key={c.caseId || i} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 font-medium text-blue-600">{c.caseId}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${STATUS_PILL[c.status] || 'bg-slate-100 text-slate-600'}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-slate-400">{c.lastUpdated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              <h3 className="text-sm font-semibold text-slate-700">Needs Attention</h3>
            </div>
            {safeAttention.length > 0 && (
              <span className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                {safeAttention.length} Urgent
              </span>
            )}
          </div>
          <div className="space-y-3">
            {safeAttention.map((c, i) => (
              <div key={c.caseId || i} className="flex items-center justify-between text-xs">
                <div>
                  <p className="font-medium text-blue-600">{c.caseId}</p>
                  <p className="text-red-500 mt-0.5">{c.issue}</p>
                </div>
                <button
                  onClick={onMakePrediction}
                  className="text-blue-600 font-medium hover:underline"
                >
                  Review
                </button>
              </div>
            ))}
          </div>
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
    </div>
  );
}

export default Dashboard;