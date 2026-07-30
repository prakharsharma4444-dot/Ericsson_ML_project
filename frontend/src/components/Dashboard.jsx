import { FolderOpen, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import StatCard from './components/StatCard';
import PriorityChart from './components/PriorityChart';
import StatusBreakdown from './components/StatusBreakdown';
import RecentActivity from './components/RecentActivity';
import NeedsAttention from './components/NeedsAttention';
import WeeklyVolume from './components/WeeklyVolume';

// Default mock data so the dashboard doesn't crash if props are empty
const defaultSummary = { totalOpen: 42, totalOverdue: 5, avgResolutionDays: 3.2, slaCompliancePct: 94 };

const defaultPriority = [
  { day: 'Mon', high: 12, medium: 30, low: 18 },
  { day: 'Tue', high: 8, medium: 22, low: 14 },
  { day: 'Wed', high: 15, medium: 28, low: 20 },
  { day: 'Thu', high: 10, medium: 25, low: 16 },
  { day: 'Fri', high: 6, medium: 18, low: 12 },
];

const defaultStatus = [
  { name: 'Open', value: 30 },
  { name: 'Closed', value: 45 },
  { name: 'Pending', value: 15 },
  { name: 'Escalated', value: 10 },
];

const defaultRecent = [
  { caseNumber: 'CS-101', subject: 'Network Latency Issue', contactName: 'Alex Smith', status: 'Open', dateOpen: '2h ago' },
  { caseNumber: 'CS-102', subject: 'Database Connection Error', contactName: 'Sarah Lee', status: 'Pending', dateOpen: '5h ago' },
  { caseNumber: 'CS-103', subject: 'Authentication Failure', contactName: 'John Doe', status: 'Closed', dateOpen: '1d ago' },
];

const defaultAttention = [
  { caseNumber: 'CS-088', subject: 'Server Downtime Region 2', caseOwner: 'Prakhar', daysUntilTarget: -2 },
  { caseNumber: 'CS-094', subject: 'Memory Leak in Pipeline', caseOwner: 'Ananya', daysUntilTarget: 1 },
];

const defaultVolume = [
  { month: 'May', opened: 80, closed: 70 },
  { month: 'Jun', opened: 110, closed: 90 },
  { month: 'Jul', opened: 130, closed: 115 },
];

function Dashboard({
  summary = defaultSummary,
  priorityData = defaultPriority,
  statusData = defaultStatus,
  recentCases = defaultRecent,
  attentionCases = defaultAttention,
  volumeData = defaultVolume
}) {
  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar active="Dashboard" />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="p-6 space-y-6">
          <h2 className="text-2xl font-bold text-gray-800">Overview</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Total Open Cases" value={summary.totalOpen} icon={FolderOpen} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
            <StatCard label="Overdue Cases" value={summary.totalOverdue} icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-500" />
            <StatCard label="Avg. Resolution" value={`${summary.avgResolutionDays}d`} icon={Clock} iconBg="bg-amber-50" iconColor="text-amber-500" />
            <StatCard label="SLA Compliance" value={`${summary.slaCompliancePct}%`} icon={CheckCircle2} iconBg="bg-green-50" iconColor="text-green-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <PriorityChart data={priorityData} />
            </div>
            <StatusBreakdown data={statusData} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <RecentActivity cases={recentCases} />
            <NeedsAttention cases={attentionCases} />
            <WeeklyVolume data={volumeData} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;