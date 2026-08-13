import { ArrowDown, ArrowUp } from 'lucide-react';

// trend: positive number = up, negative = down. trendGood: whether an
// upward trend is the desirable direction for this metric (e.g. "up" is
// bad for Overdue Cases but good for SLA Compliance).
function StatCard({ label, value, icon: Icon, iconBg, iconColor, trend, trendLabel = 'vs last week', trendGood = true }) {
  const isUp = trend > 0;
  const isGood = isUp === trendGood;
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        {Icon && (
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>
            <Icon size={16} className={iconColor} />
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-slate-800 mb-1">{value}</p>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${isGood ? 'text-green-600' : 'text-red-500'}`}>
          {isUp ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {Math.abs(trend)}% {trendLabel}
        </div>
      )}
    </div>
  );
}

export default StatCard;