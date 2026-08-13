function ModelSelectionCard({ name, tier, metrics, onSelect }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex-1 flex flex-col">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{tier}</p>
      <h3 className="text-xl font-bold text-blue-600 mt-1 mb-6">{name}</h3>

      <div className="space-y-3 flex-1">
        {Object.entries(metrics)
          .filter(([key]) => key !== 'model')
          .map(([key, value]) => (
            <MetricRow key={key} label={key.toUpperCase()} value={value} />
          ))}
      </div>

      <button
        onClick={onSelect}
        className="mt-6 w-full py-2.5 rounded-lg border border-blue-500 text-blue-600 font-medium hover:bg-blue-50 transition"
      >
        Select Model
      </button>
    </div>
  );
}

function MetricRow({ label, value }) {
  const isPercentageMetric = typeof value === 'number' && value >= 0 && value <= 1;

  const displayValue =
    value === undefined
      ? '—'
      : isPercentageMetric
      ? `${(value * 100).toFixed(1)}%`
      : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="flex justify-between items-center border-b border-gray-100 pb-2">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-800">
        {displayValue}
      </span>
    </div>
  );
}

export default ModelSelectionCard;