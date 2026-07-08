import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: React.ReactNode;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  trend?: {
    type: 'up' | 'down';
    value: string;
  };
  valueClass?: string;
  iconClass?: string;
  iconBgClass?: string;
  cardClass?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend,
  valueClass,
  iconClass,
  iconBgClass,
  cardClass
}) => {
  return (
    <div className={`card card-hover flex flex-col justify-between min-h-[120px] p-5 ${cardClass || ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="label text-xs uppercase tracking-wider block min-h-[32px]">{title}</span>
          <h3 className={`text-2xl font-bold tracking-tight mt-1 ${valueClass || 'text-[#0d1f1a]'}`}>{value}</h3>
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${iconBgClass || 'bg-[#f1f5f4]'} ${iconClass || 'text-[#023020]'}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {(description || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span className={`font-semibold ${trend.type === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {trend.type === 'up' ? '+' : '-'}{trend.value}
            </span>
          )}
          {description && <span className="text-[#8aa89f]">{description}</span>}
        </div>
      )}
    </div>
  );
};
