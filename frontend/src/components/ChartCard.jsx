function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <select className="text-xs text-gray-400 border border-gray-200 rounded-md px-2 py-1 outline-none">
          <option>This Month</option>
          <option>Last Month</option>
        </select>
      </div>
      <div className="h-64 flex items-center justify-center text-gray-300 text-sm">
        {children || 'Chart will render here'}
      </div>
    </div>
  );
}

export default ChartCard;