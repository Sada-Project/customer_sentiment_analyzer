import React, { useState } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Icon from '../../../components/AppIcon';

// ── Sentiment → color mapping ──────────────────────────────────────────────────
const SENTIMENT_COLORS = {
  satisfied:  '#10b981', // Green
  neutral:    '#64748b', // Gray/Blue
  frustrated: '#f59e0b', // Yellow/Amber
  angry:      '#ef4444', // Red
};

// ── Category index map: gives deterministic X spread per category ─────────────
const CATEGORY_X = {
  billing:   20,
  technical: 40,
  service:   55,
  product:   65,
  account:   75,
  logistics: 85,
};

/**
 * Maps a raw row from fetchTopicFrequency (topic_frequency JOIN topics)
 * into the shape required by the ScatterChart bubble.
 *
 * Raw shape (from Supabase):
 *   { call_count, avg_sentiment_score, dominant_sentiment,
 *     topics: { name, color, icon_name, category } }
 *
 * Output shape:
 *   { topic, volume, sentiment, color, description, x (0-100), y (0-100) }
 *
 * X  = category-based horizontal spread (0-100), jittered by call_count rank
 * Y  = avg_sentiment_score clamped to 0-100
 *       (high sentiment score = high Y = more positive)
 * Size (ZAxis) = call_count (volume)
 */
function mapTopicToChartPoint(row, index, total) {
  const sentiment  = (row.dominant_sentiment ?? 'neutral').toLowerCase();
  const color      = SENTIMENT_COLORS[sentiment] ?? SENTIMENT_COLORS.neutral;
  const topicName  = row.topics?.name ?? `Topic ${index + 1}`;
  const category   = (row.topics?.category ?? 'service').toLowerCase();

  // X: spread across full 0-100 using index to avoid clustering
  const baseX  = CATEGORY_X[category] ?? 50;
  const spread = total > 1 ? (index / (total - 1)) * 40 - 20 : 0; // −20 to +20
  const x      = Math.min(92, Math.max(8, baseX + spread));

  // Y: avg_sentiment_score — auto-scale from 0-1 to 0-100 if needed
  const rawScore = row.avg_sentiment_score ?? row.avg_score;
  let y = 50; // safe default
  if (rawScore != null) {
    const n = Number(rawScore);
    // If value is ≤ 1 assume 0-1 scale
    const scaled = n <= 1 ? n * 100 : n;
    y = Math.min(92, Math.max(8, Math.round(scaled)));
  } else {
    // Rank-based fallback spreads bubbles across Y
    y = Math.round(90 - (index / Math.max(total - 1, 1)) * 80);
  }

  return {
    topic:       topicName,
    volume:      row.call_count ?? 1,
    sentiment,
    color,
    description: `${topicName} — ${row.call_count ?? 0} calls (${category})`,
    x,
    y,
  };
}

// ── Static fallback data (shown when backend returns nothing) ──────────────────
const FALLBACK_DATA = [
  { topic: 'Billing Disputes',  volume: 245, sentiment: 'angry',      x: 30, y: 75, color: '#ef4444', description: 'Customers disputing charges and billing errors' },
  { topic: 'Technical Bugs',    volume: 189, sentiment: 'frustrated',  x: 60, y: 55, color: '#f59e0b', description: 'Reports of app crashes and feature malfunctions' },
  { topic: 'Refund Requests',   volume: 156, sentiment: 'frustrated',  x: 45, y: 65, color: '#f59e0b', description: 'Customers requesting refunds for various reasons' },
  { topic: 'Account Access',    volume: 134, sentiment: 'frustrated',  x: 70, y: 45, color: '#f59e0b', description: 'Login issues and password reset requests' },
  { topic: 'Feature Requests',  volume:  98, sentiment: 'neutral',     x: 50, y: 30, color: '#64748b', description: 'Suggestions for new features and improvements' },
  { topic: 'Product Praise',    volume:  87, sentiment: 'satisfied',   x: 80, y: 20, color: '#10b981', description: 'Positive feedback about product quality' },
  { topic: 'Shipping Delays',   volume:  76, sentiment: 'frustrated',  x: 35, y: 60, color: '#f59e0b', description: 'Complaints about late deliveries' },
  { topic: 'Customer Service',  volume:  65, sentiment: 'satisfied',   x: 85, y: 15, color: '#10b981', description: 'Appreciation for support team assistance' },
];

// ─────────────────────────────────────────────────────────────────────────────

const TopicBubbleChart = ({ topics = [], loading = false, error = null }) => {
  const [selectedTopic, setSelectedTopic] = useState(null);

  // Map backend rows → chart points; fall back to static data when empty
  const topicData = topics.length > 0
    ? topics.map((row, i) => mapTopicToChartPoint(row, i, topics.length))
    : FALLBACK_DATA;

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0]?.payload;
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-xl">
          <p className="text-white font-semibold mb-2">{data?.topic}</p>
          <p className="text-slate-300 text-sm mb-2">{data?.description}</p>
          <div className="space-y-1">
            <p className="text-slate-400 text-sm">Volume: <span className="text-white font-medium">{data?.volume} calls</span></p>
            <p className="text-slate-400 text-sm">Sentiment: <span className={`font-medium ${
              data?.sentiment === 'angry' ? 'text-rose-400' :
              data?.sentiment === 'frustrated' ? 'text-amber-400' :
              data?.sentiment === 'neutral'? 'text-slate-400' : 'text-emerald-400'
            }`}>{data?.sentiment?.charAt(0)?.toUpperCase() + data?.sentiment?.slice(1)}</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  const handleBubbleClick = (data) => {
    setSelectedTopic(data?.topic === selectedTopic ? null : data?.topic);
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-2">AI Topic Modeling</h3>
          <p className="text-slate-400 text-sm">Most frequent call topics by volume and sentiment</p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400 animate-pulse">
              <Icon name="Loader2" size={14} className="animate-spin" />
              Loading…
            </span>
          )}
          {!loading && topics.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Live Data
            </span>
          )}
          {!loading && topics.length === 0 && (
            <span className="text-xs text-slate-500">Demo Data</span>
          )}
          <Icon name="Brain" size={20} className="text-blue-400" />
          <span className="text-xs text-slate-400">AI-Powered</span>
        </div>
      </div>

      {/* Error banner — non-blocking, chart still renders with fallback */}
      {error && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg">
          <Icon name="AlertTriangle" size={14} className="text-rose-400 flex-shrink-0" />
          <p className="text-xs text-rose-400">{error} — showing demo data instead.</p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="text-slate-400">Satisfied</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full bg-slate-500"></div>
          <span className="text-slate-400">Neutral</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full bg-amber-500"></div>
          <span className="text-slate-400">Frustrated</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full bg-rose-500"></div>
          <span className="text-slate-400">Angry</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <XAxis 
            type="number" 
            dataKey="x" 
            name="Distribution" 
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#475569' }}
          />
          <YAxis 
            type="number" 
            dataKey="y" 
            name="Impact" 
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            axisLine={{ stroke: '#475569' }}
          />
          <ZAxis 
            type="number" 
            dataKey="volume" 
            range={[400, 2000]} 
            name="Volume"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter 
            name="Topics" 
            data={topicData} 
            onClick={handleBubbleClick}
            className="cursor-pointer"
          >
            {topicData?.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry?.color}
                opacity={selectedTopic && selectedTopic !== entry?.topic ? 0.3 : 0.8}
                stroke={selectedTopic === entry?.topic ? '#ffffff' : entry?.color}
                strokeWidth={selectedTopic === entry?.topic ? 2 : 0}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>

      {selectedTopic && (
        <div className="mt-4 p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold mb-1">{selectedTopic}</p>
              <p className="text-slate-400 text-sm">
                {topicData?.find(t => t?.topic === selectedTopic)?.description}
              </p>
            </div>
            <button 
              onClick={() => setSelectedTopic(null)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <Icon name="X" size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopicBubbleChart;