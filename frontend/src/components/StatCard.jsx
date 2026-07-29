import { TrendingUp, TrendingDown } from 'lucide-react';

function StatCard({ 
  label, 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendDirection = 'up', 
  iconBg = 'bg-blue-50', 
  iconColor = 'text-blue-500' 
}) {
  const TrendIcon = trendDirection === 'up' ? TrendingUp : TrendingDown;
  const trendColor = trendDirection === 'up' ? 'text-green-500' : 'text-red-500';
  const displayLabel = label || title;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">{displayLabel}</p>
        {Icon && (
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${iconBg}`}>
            <Icon size={16} className={iconColor} />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {trend && (
        <p className={`text-xs mt-1 flex items-center gap-1 ${trendColor}`}>
          <TrendIcon size={12} />
          {trend}
        </p>
      )}
    </div>
  );
}

export default StatCard;