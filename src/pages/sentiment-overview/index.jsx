import React, { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import KPICard from './components/KPICard';
import GlobalControls from './components/GlobalControls';
import SentimentTimelineChart from './components/SentimentTimelineChart';
import LiveActivityFeed from './components/LiveActivityFeed';
import SentimentDistributionChart from './components/SentimentDistributionChart';
import Icon from '../../components/AppIcon';
import {
  fetchKPIs,
  fetchSentimentTimeline,
  fetchLiveActivity,
  fetchSentimentDistribution,
  fetchQuickStats,
} from '../../services/sentimentOverviewService';

// ─── Icon map for KPI cards (metric_key → icon) ───────────────────────────────
const KPI_ICON_MAP = {
  overall_sentiment:  { icon: 'TrendingUp',  title: 'Overall Sentiment Score' },
  files_processed:    { icon: 'FileCheck',   title: 'Files Processed Today'   },
};

// ─── Fallback KPIs (shown while loading or on error) ─────────────────────────
const FALLBACK_KPIS = [
  { title: 'Overall Sentiment Score', value: '—', change: '—', changeType: 'neutral', icon: 'TrendingUp',  sparklineData: [] },
  { title: 'Files Processed Today',   value: '—', change: '—', changeType: 'neutral', icon: 'FileCheck',   sparklineData: [] },
];

const SentimentOverview = () => {
  const [dateRange, setDateRange]           = useState('24h');
  const [kpiData, setKpiData]               = useState(FALLBACK_KPIS);
  const [timelineData, setTimelineData]     = useState([]);
  const [liveActivities, setLiveActivities] = useState([]);
  const [distributionData, setDistribution] = useState([]);
  const [quickStats, setQuickStats]         = useState(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [lastUpdated, setLastUpdated]       = useState(null);
  const [refreshing, setRefreshing]         = useState(false);

  // ── Core fetch ─────────────────────────────────────────────────────────────
  const loadData = useCallback((range, isRefresh = false) => {
    let cancelled = false;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);

    const hours = range === '24h' ? 24 : range === '7d' ? 168 : 720;

    Promise.all([
      fetchKPIs(range),
      fetchSentimentTimeline(hours),
      fetchLiveActivity(10),
      fetchSentimentDistribution(),
      fetchQuickStats(),
    ])
      .then(([kpis, timeline, activity, distribution, stats]) => {
        if (cancelled) return;

        // Map KPI snapshots → card format
        if (kpis.length > 0) {
          const EXCLUDED_KEYS = ['processing_accuracy', 'satisfaction_trend'];
          setKpiData(kpis
            .filter((row) => !EXCLUDED_KEYS.includes(row.metric_key))
            .map((row) => {
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
            })
          );
        }

        if (timeline.length    > 0) setTimelineData(timeline);
        if (activity.length    > 0) setLiveActivities(activity);
        if (distribution.length > 0) setDistribution(distribution);
        if (stats) setQuickStats(stats);

        setLastUpdated(new Date());
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  // ── Fetch on mount & date range change ────────────────────────────────────
  useEffect(() => {
    const cleanup = loadData(dateRange);
    return cleanup;
  }, [dateRange, loadData]);

  // ── Manual refresh ────────────────────────────────────────────────────────
  const handleRefresh = () => loadData(dateRange, true);

  const handleDrillDown = (sentiment) => {
    console.log(`Drilling down into ${sentiment} sentiment transcripts`);
  };

  const formatLastUpdated = (date) => {
    if (!date) return null;
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="container mx-auto p-6 max-w-[1600px]">

          {/* Page Title */}
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">Post-Call Analytics System</h1>
              <p className="text-muted-foreground text-sm">
                Batch processing sentiment monitoring and comprehensive call analysis dashboard
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1 flex-shrink-0">
              {lastUpdated && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Updated {formatLastUpdated(lastUpdated)}
                </span>
              )}
              {loading && !refreshing && (
                <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
              )}
              {error && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <Icon name="AlertCircle" size={13} />
                  {error}
                </span>
              )}
              <button
                onClick={handleRefresh}
                disabled={loading || refreshing}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon
                  name="RefreshCw"
                  size={13}
                  className={refreshing ? 'animate-spin' : ''}
                />
                Refresh
              </button>
            </div>
          </div>

          {/* Quick Stats Bar */}
          {quickStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Calls Today',     value: quickStats.totalCallsToday?.toLocaleString() ?? '—', icon: 'Phone',      color: 'text-blue-500'   },
                { label: 'Active Agents',   value: quickStats.activeAgents ?? '—',                       icon: 'Users',      color: 'text-emerald-500'},
                { label: 'Avg Sentiment',   value: quickStats.avgSentimentToday ? `${quickStats.avgSentimentToday}%` : '—', icon: 'Activity', color: 'text-violet-500'},
                { label: 'In Queue',        value: quickStats.pendingQueue ?? '—',                        icon: 'Clock3',     color: 'text-amber-500'  },
              ].map((stat) => (
                <div key={stat.label} className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-3">
                  <div className={`${stat.color} flex-shrink-0`}>
                    <Icon name={stat.icon} size={20} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground leading-tight">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <GlobalControls dateRange={dateRange} onDateRangeChange={setDateRange} />

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            {kpiData.map((kpi) => (
              <KPICard key={kpi.title} {...kpi} />
            ))}
          </div>

          {/* Timeline + Live Feed */}
          <div className="flex flex-col lg:flex-row gap-5 mb-5 items-stretch">
            <div className="lg:flex-[2]">
              <SentimentTimelineChart data={timelineData} />
            </div>
            <div className="lg:flex-[1]">
              <LiveActivityFeed activities={liveActivities} />
            </div>
          </div>

          {/* Distribution Chart */}
          <div className="mb-5">
            <SentimentDistributionChart
              data={distributionData}
              onDrillDown={handleDrillDown}
            />
          </div>

        </div>
      </main>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--color-primary); }
      `}</style>
    </>
  );
};

export default SentimentOverview;
