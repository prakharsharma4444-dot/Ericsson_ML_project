import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = {
  Open: '#1E1B4B',
  Closed: '#F97316',
  Pending: '#D946EF',
  Escalated: '#4C49ED',
};

// data shape: [{ name: 'Open', value: 30 }, { name: 'Closed', value: 15 }, ...]
function StatusBreakdown({ data }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Status Breakdown</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={0}
            outerRadius={110}
            paddingAngle={2}
            label={({ name, value }) => `${Math.round((value / total) * 100)}%\n${name}`}
            labelLine={false}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] || '#94A3B8'} stroke="none" />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [`${value} cases`, name]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default StatusBreakdown;