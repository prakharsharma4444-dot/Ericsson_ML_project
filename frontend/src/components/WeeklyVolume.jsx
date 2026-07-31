import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// data shape: [{ month: 'Jul', opened: 120, closed: 95 }, ...]
function WeeklyVolume({ data }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Case Volume</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="openedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4C49ED" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#4C49ED" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F1F4" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <Tooltip />
          <Area type="monotone" dataKey="opened" stroke="#4C49ED" strokeWidth={2} fill="url(#openedFill)" />
          <Area type="monotone" dataKey="closed" stroke="#22C3A6" strokeWidth={2} fill="none" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default WeeklyVolume;