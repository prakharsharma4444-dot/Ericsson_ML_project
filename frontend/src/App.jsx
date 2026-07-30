import { useState } from 'react';
import { Rows3, Columns3, AlertTriangle, Hash } from 'lucide-react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import StatCard from './components/StatCard';
import UploadCard from './components/UploadCard';
import ModelSelectionScreen from './components/ModelSelectionScreen';
import PriorityChart from './components/PriorityChart';
import StatusBreakdown from './components/StatusBreakdown';
import RecentActivity from './components/RecentActivity';
import NeedsAttention from './components/NeedsAttention';
import WeeklyVolume from './components/WeeklyVolume';
import { getColumns, analyzeDataset } from './api';

// Adjust these to match your actual CSV column names exactly (case-sensitive).
const COL = {
  caseNumber: 'case_number',
  subject: 'subject',
  contactName: 'contact_name',
  status: 'status',
  priority: 'priority',
  dateOpen: 'date_open',
  caseOwner: 'case_owner',
  remedyTarget: 'remedy_target',
};

function buildDashboardData(preview) {
  const rows = preview || [];

  // Status Breakdown: count rows per status value
  const statusCounts = {};
  rows.forEach((r) => {
    const val = r[COL.status] || 'Unknown';
    statusCounts[val] = (statusCounts[val] || 0) + 1;
  });
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Priority of Cases: count High/Medium/Low per day-of-week from date_open
  const dayBuckets = { Mon: {}, Tue: {}, Wed: {}, Thu: {}, Fri: {}, Sat: {}, Sun: {} };
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  rows.forEach((r) => {
    const dateVal = r[COL.dateOpen];
    const priority = (r[COL.priority] || 'low').toLowerCase();
    if (!dateVal) return;
    const d = new Date(dateVal);
    if (isNaN(d)) return;
    const day = dayNames[d.getDay()];
    dayBuckets[day][priority] = (dayBuckets[day][priority] || 0) + 1;
  });
  const priorityData = Object.entries(dayBuckets).map(([day, counts]) => ({
    day,
    high: counts.high || 0,
    medium: counts.medium || 0,
    low: counts.low || 0,
  }));

  // Recent Activity: last 5 rows as-is
  const recentCases = rows.slice(0, 5).map((r) => ({
    caseNumber: r[COL.caseNumber],
    subject: r[COL.subject],
    contactName: r[COL.contactName],
    status: r[COL.status],
    dateOpen: r[COL.dateOpen],
  }));

  // Needs Attention: rows whose remedy target is closest to today (or overdue)
  const today = new Date();
  const attentionCases = rows
    .filter((r) => r[COL.remedyTarget])
    .map((r) => {
      const target = new Date(r[COL.remedyTarget]);
      const daysUntilTarget = Math.round((target - today) / (1000 * 60 * 60 * 24));
      return {
        caseNumber: r[COL.caseNumber],
        subject: r[COL.subject],
        caseOwner: r[COL.caseOwner],
        daysUntilTarget,
      };
    })
    .sort((a, b) => a.daysUntilTarget - b.daysUntilTarget)
    .slice(0, 5);

  // Weekly Volume: cases opened per month (from date_open); "closed" left at 0 unless you have a close-date column
  const monthCounts = {};
  rows.forEach((r) => {
    const dateVal = r[COL.dateOpen];
    if (!dateVal) return;
    const d = new Date(dateVal);
    if (isNaN(d)) return;
    const month = d.toLocaleString('default', { month: 'short' });
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  });
  const volumeData = Object.entries(monthCounts).map(([month, opened]) => ({ month, opened, closed: 0 }));

  return { statusData, priorityData, recentCases, attentionCases, volumeData };
}

function App() {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    setError(null);
    try {
      const data = await getColumns(selectedFile);
      setColumns(data.columns);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  };

  const handleTargetSelect = async (col) => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeDataset(file, col);
      setAnalysis(result);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
    setLoading(false);
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-lg text-center">
          <h2 className="text-lg font-bold text-red-600 mb-2">Something went wrong</h2>
          <p className="text-sm text-gray-600 break-words">{error}</p>
        </div>
      </div>
    );
  }

  if (!file) {
    return <UploadCard onFileSelect={handleFileSelect} />;
  }

  if (columns && !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-md">
          <h2 className="text-xl font-bold mb-4">Select Target Column</h2>
          <select
            className="w-full border rounded-lg p-2 mb-4"
            onChange={(e) => handleTargetSelect(e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>Choose a column to predict</option>
            {columns.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
          {loading && <p className="text-sm text-gray-400">Training models, please wait…</p>}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Loading analysis...</p>
      </div>
    );
  }

  if (analysis && !selectedModel) {
    return (
      <ModelSelectionScreen
        results={analysis.results}
        onModelSelect={setSelectedModel}
      />
    );
  }

  const s = analysis.summary;
  const { statusData, priorityData, recentCases, attentionCases, volumeData } = buildDashboardData(analysis.preview);

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar active="Dashboard" />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="p-6 space-y-6">
          <p className="text-sm text-gray-500">
            Showing results for <span className="font-semibold text-gray-700">{selectedModel}</span>
          </p>

          <div className="grid grid-cols-4 gap-4">
            <StatCard label="Total Rows" value={s.total_rows} icon={Rows3} iconBg="bg-blue-50" iconColor="text-blue-500" />
            <StatCard label="Total Columns" value={s.total_columns} icon={Columns3} iconBg="bg-purple-50" iconColor="text-purple-500" />
            <StatCard label="Missing Values" value={s.missing_values} icon={AlertTriangle} iconBg="bg-orange-50" iconColor="text-orange-500" />
            <StatCard label="Numeric Features" value={s.numeric_features} icon={Hash} iconBg="bg-green-50" iconColor="text-green-500" />
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2">
              <PriorityChart data={priorityData} />
            </div>
            <StatusBreakdown data={statusData} />
          </div>

          <div className="grid grid-cols-3 gap-6">
            <RecentActivity cases={recentCases} />
            <NeedsAttention cases={attentionCases} />
            <WeeklyVolume data={volumeData} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;