import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Icon from '../../../components/AppIcon';

const SentimentTimelineChart = ({ data }) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      const total = payload.reduce((sum, e) => sum + (e?.value ?? 0), 0);
      return (
        <div className="bg-card border border-border rounded-lg p-4 shadow-lg min-w-[180px]">
          <p className="text-sm font-semibold text-foreground mb-2">🕐 {label}</p>
          {payload?.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: entry?.color }}
                />
                <span className="text-xs text-muted-foreground capitalize">{entry?.name}</span>
              </div>
              <span className="text-xs font-semibold text-foreground">{entry?.value}</span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-xs font-bold text-foreground">
              {payload?.[0]?.payload?.interactions ?? total} calls
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const isEmpty = !data || data.length === 0;

  return (
    <div className="bg-card border-2 border-border rounded-lg p-6 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Real-Time Emotion Timeline</h2>
          <p className="text-sm text-muted-foreground mt-1">Customer emotion patterns — call counts per time bucket</p>
        </div>
        {!isEmpty && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-600">Live</span>
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="flex-grow flex flex-col items-center justify-center text-center py-12">
          <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
            <Icon name="BarChart2" size={24} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No timeline data available</p>
          <p className="text-xs text-muted-foreground">Call activity will appear here once calls are processed</p>
        </div>
      ) : (
        <div className="w-full" style={{ height: '320px' }} aria-label="Emotion Timeline Chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              onMouseMove={(e) => e && e?.activePayload && setHoveredPoint(e?.activePayload?.[0])}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="time"
                stroke="var(--color-muted-foreground)"
                style={{ fontSize: '11px' }}
                tick={{ fill: 'var(--color-muted-foreground)' }}
              />
              <YAxis
                stroke="var(--color-muted-foreground)"
                style={{ fontSize: '11px' }}
                tick={{ fill: 'var(--color-muted-foreground)' }}
                label={{
                  value: 'Calls',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: 'var(--color-muted-foreground)', fontSize: '11px' },
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }}
                iconType="circle"
              />
              <Line type="monotone" dataKey="satisfied"  stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} activeDot={{ r: 5 }} name="Satisfied"  />
              <Line type="monotone" dataKey="neutral"    stroke="#64748b" strokeWidth={2} dot={{ fill: '#64748b', r: 3 }} activeDot={{ r: 5 }} name="Neutral"    />
              <Line type="monotone" dataKey="frustrated" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} activeDot={{ r: 5 }} name="Frustrated" />
              <Line type="monotone" dataKey="angry"      stroke="#f43f5e" strokeWidth={2} dot={{ fill: '#f43f5e', r: 3 }} activeDot={{ r: 5 }} name="Angry"      />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default SentimentTimelineChart;