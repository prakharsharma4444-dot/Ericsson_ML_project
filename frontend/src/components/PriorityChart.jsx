import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// data shape: [{ day: 'Mon', high: 12, medium: 30, low: 18 }, ...]
function PriorityChart({ data }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Priority of Cases</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F1F4" />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: '#F9FAFB' }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="high" name="High" fill="#4C49ED" radius={[4, 4, 0, 0]} />
          <Bar dataKey="medium" name="Medium" fill="#22C3A6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="low" name="Low" fill="#F472B6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default PriorityChart;