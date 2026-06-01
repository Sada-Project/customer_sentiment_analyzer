import React, { useState, useEffect, useCallback } from 'react';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Cell, CartesianGrid } from 'recharts';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

// ── Constants ─────────────────────────────────────────────────────────────────
const DAYS_ORDER  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS_ORDER = ['00:00','02:00','04:00','06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00'];
const DAY_NAMES   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMOTION_COLOR = {
  Satisfied:  '#10B981',
  Neutral:    '#64748b',
  Frustrated: '#F59E0B',
  Angry:      '#EF4444',
};

const scoreToEmotion = (score) => {
  if (score >= 70) return 'Satisfied';
  if (score >= 50) return 'Neutral';
  if (score >= 30) return 'Frustrated';
  return 'Angry';
};

// ── Week helpers ──────────────────────────────────────────────────────────────
const getWeekRange = (weekOffset = 0) => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday - weekOffset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
};

const formatWeekLabel = (weekOffset, range) => {
  if (weekOffset === 0) return 'This Week';
  if (weekOffset === 1) return 'Last Week';
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(range.start)} – ${fmt(range.end)}`;
};

// ── Aggregate raw DB rows → heatmap points ────────────────────────────────────
const aggregateCalls = (calls) => {
  if (!calls.length) return [];

  // Auto-detect sentiment_score scale (0-1 vs 0-100)
  const rawVals = calls.map(c => Number(c.sentiment_score ?? 0)).filter(v => v > 0);
  const avgRaw  = rawVals.length ? rawVals.reduce((s, v) => s + v, 0) / rawVals.length : 50;
  const scale   = avgRaw <= 1 ? 100 : 1;

  const buckets = {};
  for (const call of calls) {
    const dt   = new Date(call.created_at);
    const day  = DAY_NAMES[dt.getDay()];
    const slot = HOURS_ORDER[Math.floor(dt.getHours() / 2)];
    const key  = `${day}|${slot}`;
    if (!buckets[key]) buckets[key] = { scores: [], sentiments: [] };
    const score = Number(call.sentiment_score ?? 0) * scale;
    buckets[key].scores.push(score > 0 ? score : 50);
    if (call.sentiment) buckets[key].sentiments.push(call.sentiment.toLowerCase());
  }

  return Object.entries(buckets).map(([key, { scores, sentiments }]) => {
    const [day, hour] = key.split('|');
    const avgScore    = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const counts   = {};
    for (const s of sentiments) counts[s] = (counts[s] ?? 0) + 1;
    const emotion  = sentiments.length
      ? (() => {
          const dom = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
          return dom.charAt(0).toUpperCase() + dom.slice(1);
        })()
      : scoreToEmotion(avgScore);
    return { day, hour, sentiment: avgScore, interactions: scores.length, emotion, ghost: false };
  });
};

// ── Pad real data with ghost points so ALL hour slots appear on the X-axis ────
// IMPORTANT: iterate HOURS_ORDER first so Recharts registers categories in order.
const padWithGhosts = (realPoints) => {
  // Build a lookup of existing real points
  const realMap = {};
  for (const p of realPoints) realMap[`${p.day}|${p.hour}`] = p;

  // Only pad days that actually have data (don't create rows for empty days)
  const activeDays = [...new Set(realPoints.map(p => p.day))];

  const result = [];
  // Iterate hours in order first → guarantees X-axis is 00:00 → 02:00 → … → 22:00
  for (const hour of HOURS_ORDER) {
    for (const day of activeDays) {
      const key = `${day}|${hour}`;
      result.push(
        realMap[key] ?? { day, hour, sentiment: 0, interactions: 0, emotion: '', ghost: true }
      );
    }
  }
  return result;
};


// ── Tooltip ───────────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d     = payload[0]?.payload;
  const color = EMOTION_COLOR[d?.emotion] ?? '#64748b';
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg min-w-[160px]">
      <p className="text-sm font-semibold text-foreground mb-2">{d?.day} · {d?.hour}</p>
      <div className="space-y-1 text-xs">
        <p className="text-muted-foreground">
          Emotion: <span className="font-medium" style={{ color }}>{d?.emotion}</span>
        </p>
        <p className="text-muted-foreground">
          Avg Score: <span className="text-foreground font-medium">{d?.sentiment}%</span>
        </p>
        <p className="text-muted-foreground">
          Calls: <span className="text-foreground font-medium">{d?.interactions}</span>
        </p>
      </div>
    </div>
  );
};

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState = ({ label }) => (
  <div className="w-full h-96 flex flex-col items-center justify-center text-center gap-3">
    <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center">
      <Icon name="CalendarOff" size={26} className="text-muted-foreground" />
    </div>
    <p className="text-sm font-medium text-foreground">No calls found for {label}</p>
    <p className="text-xs text-muted-foreground">Try selecting a different week</p>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const SentimentHeatmap = () => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [chartData,  setChartData]  = useState([]);
  const [fetching,   setFetching]   = useState(false);
  const [fetchErr,   setFetchErr]   = useState(null);
  const [totalCalls, setTotalCalls] = useState(0);

  const currentRange = getWeekRange(weekOffset);

  const loadWeek = useCallback(async (offset) => {
    setFetching(true);
    setFetchErr(null);
    setChartData([]);

    try {
      const { start, end } = getWeekRange(offset);

      // Query 1: try with status = completed for the selected week
      const { data: completed, error: e1 } = await supabase
        .from('call_recordings')
        .select('created_at, sentiment, sentiment_score')
        .eq('status', 'completed')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true });

      if (e1) throw e1;

      let calls = completed ?? [];

      // Query 2: if no completed calls, include all statuses for that week
      if (calls.length === 0) {
        const { data: allStatus, error: e2 } = await supabase
          .from('call_recordings')
          .select('created_at, sentiment, sentiment_score')
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString())
          .order('created_at', { ascending: true });

        if (e2) throw e2;
        calls = allStatus ?? [];
      }

      setTotalCalls(calls.length);
      setChartData(padWithGhosts(aggregateCalls(calls)));
    } catch (err) {
      setFetchErr(err.message ?? 'Failed to load');
      setChartData([]);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => { loadWeek(weekOffset); }, [weekOffset, loadWeek]);

  const weekLabel = formatWeekLabel(weekOffset, currentRange);

  return (
    <div className="bg-card rounded-lg p-8 border border-border">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Icon name="Activity" size={20} />
            Sentiment Heatmap
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Customer emotion patterns across time periods and interaction types
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status badge */}
          {fetching ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
              <Icon name="Loader2" size={13} className="animate-spin" />
              Loading…
            </span>
          ) : fetchErr ? (
            <span className="text-xs text-rose-400 flex items-center gap-1">
              <Icon name="AlertTriangle" size={13} />
              {fetchErr}
            </span>
          ) : (
            <span className={`flex items-center gap-1.5 text-xs ${chartData.length > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${chartData.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {chartData.length > 0
                ? `Live · ${totalCalls} call${totalCalls !== 1 ? 's' : ''}`
                : 'No data'}
            </span>
          )}

          {/* Week navigation arrows */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-card transition-all"
              title="Previous week"
            >
              <Icon name="ChevronLeft" size={16} />
            </button>
            <span className="px-3 py-1 text-xs font-medium text-foreground min-w-[120px] text-center">
              {weekLabel}
            </span>
            <button
              onClick={() => setWeekOffset(w => Math.max(0, w - 1))}
              disabled={weekOffset === 0}
              className={`p-1.5 rounded-md transition-all ${
                weekOffset > 0
                  ? 'text-muted-foreground hover:text-foreground hover:bg-card'
                  : 'text-muted-foreground/25 cursor-not-allowed'
              }`}
              title="Next week"
            >
              <Icon name="ChevronRight" size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick-select pills ── */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {[
          { offset: 0, label: 'This Week'    },
          { offset: 1, label: 'Last Week'    },
          { offset: 2, label: '2 Weeks Ago'  },
          { offset: 3, label: '3 Weeks Ago'  },
          { offset: 4, label: '4 Weeks Ago'  },
        ].map(({ offset, label }) => (
          <button
            key={offset}
            onClick={() => setWeekOffset(offset)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-all ${
              weekOffset === offset
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Chart or empty state ── */}
      {chartData.length === 0 && !fetching ? (
        <EmptyState label={weekLabel} />
      ) : (
        <div className="w-full h-96">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                type="category"
                dataKey="hour"
                name="Time"
                allowDuplicatedCategory={false}
                categories={HOURS_ORDER}
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                stroke="var(--color-border)"
              />
              <YAxis
                type="category"
                dataKey="day"
                name="Day"
                allowDuplicatedCategory={false}
                categories={DAYS_ORDER}
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
                stroke="var(--color-border)"
                width={36}
              />
              <ZAxis type="number" dataKey="interactions" range={[0, 500]} name="Calls" />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={chartData} shape="circle">
                {chartData.map((entry, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={entry.ghost ? 'transparent' : (EMOTION_COLOR[entry.emotion] ?? '#64748b')}
                    opacity={entry.ghost ? 0 : 0.85}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="flex flex-wrap items-center justify-center gap-6 mt-6 pt-4 border-t border-border">
        {Object.entries(EMOTION_COLOR).map(([label, color]) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-muted-foreground">
              {label}
              {label === 'Satisfied'  && ' (≥70%)'}
              {label === 'Neutral'    && ' (50-69%)'}
              {label === 'Frustrated' && ' (30-49%)'}
              {label === 'Angry'      && ' (<30%)'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SentimentHeatmap;