import React from 'react';
import Icon from '../../../components/AppIcon';

const KPICard = ({ title, value, change, changeType, icon, sparklineData }) => {
  const getChangeColor = () => {
    if (changeType === 'positive') return 'text-success';
    if (changeType === 'negative') return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getChangeIcon = () => {
    if (changeType === 'positive') return 'TrendingUp';
    if (changeType === 'negative') return 'TrendingDown';
    return 'Minus';
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-150">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
            <Icon name={icon} size={20} color="var(--color-primary)" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-3xl font-bold text-foreground">{value}</p>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 ${getChangeColor()}`}>
            <Icon name={getChangeIcon()} size={16} />
            <span className="text-sm font-medium">{change}</span>
          </div>

        </div>
      </div>
      {sparklineData && (
        <div className="mt-4 h-12 flex items-end gap-1">
          {sparklineData?.map((value, index) => (
            <div
              key={index}
              className="flex-1 bg-primary/20 rounded-t transition-all duration-150 hover:bg-primary/40"
              style={{ height: `${value}%` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default KPICard;