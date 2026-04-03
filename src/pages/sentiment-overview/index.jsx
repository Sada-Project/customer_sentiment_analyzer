import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import KPICard from './components/KPICard';
import GlobalControls from './components/GlobalControls';
import SentimentTimelineChart from './components/SentimentTimelineChart';
import LiveActivityFeed from './components/LiveActivityFeed';
import SentimentDistributionChart from './components/SentimentDistributionChart';
import {
  fetchKPIs,
  fetchSentimentTimeline,
  fetchLiveActivity,
  fetchSentimentDistribution,
} from '../../services/sentimentOverviewService';

// ─── Icon map for KPI cards (metric_key → icon) ───────────────────────────────
const KPI_ICON_MAP = {
  overall_sentiment:  { icon: 'TrendingUp',  title: 'Overall Sentiment Score' },
  files_processed:    { icon: 'FileCheck',   title: 'Files Processed Today'   },
  satisfaction_trend: { icon: 'Heart',       title: 'Satisfaction Trend'      },
  processing_accuracy:{ icon: 'Target',      title: 'Processing Accuracy'     },
};

// ─── Fallback static data (shown while loading or on error) ───────────────────
const FALLBACK_KPIS = [
  { title: 'Overall Sentiment Score', value: '—', change: '—', changeType: 'neutral', icon: 'TrendingUp',  sparklineData: [] },
  { title: 'Files Processed Today',   value: '—', change: '—', changeType: 'neutral', icon: 'FileCheck',   sparklineData: [] },
  { title: 'Satisfaction Trend',      value: '—', change: '—', changeType: 'neutral', icon: 'Heart',       sparklineData: [] },
  { title: 'Processing Accuracy',     value: '—', change: '—', changeType: 'neutral', icon: 'Target',      sparklineData: [] },
];

const SentimentOverview = () => {
  const [dateRange, setDateRange]           = useState('24h');
  const [kpiData, setKpiData]               = useState(FALLBACK_KPIS);
  const [timelineData, setTimelineData]     = useState([]);
  const [liveActivities, setLiveActivities] = useState([]);
  const [distributionData, setDistribution] = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);

  // ── Fetch all data on mount & when dateRange changes ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const hours = dateRange === '24h' ? 24 : dateRange === '7d' ? 168 : 720;

    Promise.all([
      fetchKPIs(dateRange),
      fetchSentimentTimeline(hours),
      fetchLiveActivity(10),
      fetchSentimentDistribution(),
    ])
      .then(([kpis, timeline, activity, distribution]) => {
        if (cancelled) return;

        // Map KPI snapshots → card format
        if (kpis.length > 0) {
          setKpiData(kpis.map((row) => {
            const meta = KPI_ICON_MAP[row.metric_key] ?? {};
            const unit = row.metric_unit === '%' ? '%' : '';
            const val  = row.metric_unit === '%'
              ? `${Number(row.metric_value).toFixed(1)}%`
              : Number(row.metric_value).toLocaleString();
            const chg  = row.change_value != null
              ? `${row.change_value > 0 ? '+' : ''}${Number(row.change_value).toFixed(1)}${unit}`
              : '—';
            return {
              title:        meta.title ?? row.metric_label,
              value:        val,
              change:       chg,
              changeType:   row.change_type ?? 'neutral',
              icon:         meta.icon ?? 'BarChart2',
              sparklineData: Array.isArray(row.sparkline_data) ? row.sparkline_data : [],
            };
          }));
        }

        if (timeline.length > 0)     setTimelineData(timeline);
        if (activity.length > 0)     setLiveActivities(activity);
        if (distribution.length > 0) setDistribution(distribution);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [dateRange]);

  const handleDrillDown = (sentiment) => {
    console.log(`Drilling down into ${sentiment} sentiment transcripts`);
  };

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="container mx-auto p-6 max-w-[1600px]">

          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Post-Call Analytics System</h1>
              <p className="text-muted-foreground">
                Batch processing sentiment monitoring and comprehensive call analysis dashboard
              </p>
            </div>
            {loading && (
              <span className="text-xs text-muted-foreground animate-pulse mt-2">Loading…</span>
            )}
            {error && (
              <span className="text-xs text-destructive mt-2">⚠ {error}</span>
            )}
          </div>

          <GlobalControls dateRange={dateRange} onDateRangeChange={setDateRange} />

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {kpiData.map((kpi) => (
              <KPICard key={kpi.title} {...kpi} />
            ))}
          </div>

          {/* Timeline + Live Feed */}
          <div className="flex flex-col lg:flex-row gap-6 mb-6 items-stretch">
            <div className="lg:flex-[2]">
              <SentimentTimelineChart data={timelineData} />
            </div>
            <div className="lg:flex-[1]">
              <LiveActivityFeed activities={liveActivities} />
            </div>
          </div>

          {/* Distribution Chart */}
          <div className="mb-6">
            <SentimentDistributionChart
              data={distributionData}
              onDrillDown={handleDrillDown}
            />
          </div>

        </div>
      </main>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: var(--color-muted); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-primary); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { opacity: 0.8; }
      `}</style>
    </>
  );
};

export default SentimentOverview;
