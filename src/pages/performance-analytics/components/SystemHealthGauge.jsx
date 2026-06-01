import React from 'react';
import Icon from '../../../components/AppIcon';

const SystemHealthGauge = ({ title, value, max, unit, icon, thresholds }) => {
  const percentage = (value / max) * 100;
  
  const getStatusColor = () => {
    if (percentage >= thresholds?.critical) return 'text-error';
    if (percentage >= thresholds?.warning) return 'text-warning';
    return 'text-success';
  };

  const getGaugeColor = () => {
    if (percentage >= thresholds?.critical) return 'var(--color-error)';
    if (percentage >= thresholds?.warning) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  const getStatusLabel = () => {
    if (percentage >= thresholds?.critical) return 'Critical';
    if (percentage >= thresholds?.warning) return 'Warning';
    return 'Healthy';
  };

  const circumference = 2 * Math.PI * 88;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="bg-card border border-border rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
          <Icon name={icon} size={16} color="var(--color-muted-foreground)" />
        </div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative w-52 h-52">
          <svg className="transform -rotate-90 w-52 h-52" viewBox="0 0 208 208">
            <circle
              cx="104"
              cy="104"
              r="88"
              stroke="var(--color-muted)"
              strokeWidth="10"
              fill="none"
            />
            <circle
              cx="104"
              cy="104"
              r="88"
              stroke={getGaugeColor()}
              strokeWidth="10"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-4xl font-bold ${getStatusColor()}`}>
              {value}{unit}
            </span>
            <span className="text-sm text-muted-foreground mt-1">of {max}{unit}</span>
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()?.replace('text-', 'bg-')}`} />
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusLabel()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthGauge;