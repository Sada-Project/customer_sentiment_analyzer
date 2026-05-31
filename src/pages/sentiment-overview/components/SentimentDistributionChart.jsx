import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const SentimentDistributionChart = ({ data, onDrillDown }) => {
  const [selectedSegment, setSelectedSegment] = useState(null);

  const COLORS = {
    satisfied: '#19c27eff',
    neutral: '#64748b',
    frustrated: '#f59e0b',
    angry: '#f43f5e'
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0];
      return (
        <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
          <p className="text-sm font-medium text-foreground mb-2 capitalize">{data?.name}</p>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Count: <span className="font-medium text-foreground">{data?.value}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Percentage: <span className="font-medium text-foreground">{data?.payload?.percentage}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleSegmentClick = (entry) => {
    setSelectedSegment(entry?.name);
    if (onDrillDown) {
      onDrillDown(entry?.name);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Emotion Distribution</h2>
          <p className="text-sm text-muted-foreground mt-1">Customer emotion category breakdown</p>
        </div>
        <Button 
          variant="outline" 
          iconName="Download" 
          iconPosition="left"
          onClick={() => console.log('Export distribution data')}
        >
          Export
        </Button>
      </div>

      {(!data || data.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
            <Icon name="PieChart" size={24} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No distribution data</p>
          <p className="text-xs text-muted-foreground">Sentiment distribution will appear here once calls are processed</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="w-full h-80" aria-label="Emotion Distribution Donut Chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  onClick={handleSegmentClick}
                  style={{ cursor: 'pointer' }}
                >
                  {data?.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS?.[entry?.name]}
                      opacity={selectedSegment && selectedSegment !== entry?.name ? 0.3 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  iconType="circle"
                  formatter={(value) => <span className="capitalize text-sm">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground mb-3">Detailed Breakdown</h3>
            {data?.map((item) => (
              <div 
                key={item?.name}
                className={`p-4 rounded-lg border transition-all duration-150 cursor-pointer ${
                  selectedSegment === item?.name 
                    ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/20'
                }`}
                onClick={() => handleSegmentClick(item)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: COLORS?.[item?.name] }}
                    />
                    <span className="text-sm font-medium text-foreground capitalize">{item?.name}</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{item?.percentage}%</span>
                </div>
                
                <div className="w-full bg-muted rounded-full h-1.5 mb-2">
                  <div 
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min(Number(item?.percentage), 100)}%`,
                      backgroundColor: COLORS?.[item?.name]
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{Number(item?.value).toLocaleString()} calls</span>
                  <span className="text-primary/70">Click to drill down →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SentimentDistributionChart;