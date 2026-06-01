import React, { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import KPICard from './components/KPICard';
import SentimentTimelineChart from './components/SentimentTimelineChart';
import SentimentDistributionChart from './components/SentimentDistributionChart';
import Icon from '../../components/AppIcon';
import {
  fetchFilesProcessedToday,
  fetchOverallSentiment,
  fetchSentimentTimeline,
  fetchSentimentDistribution,
} from '../../services/sentimentOverviewService';

// ─── Skeleton KPI card (while loading) ───────────────────────────────────────
const LOADING_KPI = {
  files: {
    title: 'Files Processed Today',
    value: '—',
    change: '—',
    changeType: 'neutral',
    icon: 'FileCheck',
    sparklineData: [],
  },
  sentiment: {
    title: 'Overall Sentiment',
    value: '—',
    change: '—',
    changeType: 'neutral',
    icon: 'SmilePlus',
    sparklineData: [],
  },
};

const SentimentOverview = () => {
  const [filesKPI,         setFilesKPI]         = useState(LOADING_KPI.files);
  const [sentimentKPI,     setSentimentKPI]     = useState(LOADING_KPI.sentiment);
  const [timelineData,     setTimelineData]     = useState([]);
  const [distributionData, setDistribution]     = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [errors,           setErrors]           = useState({});
  const [lastUpdated,      setLastUpdated]      = useState(null);
  const [refreshing,       setRefreshing]       = useState(false);

  // ── Load all 4 widgets in parallel ───────────────────────────────────────
  const loadData = useCallback((isRefresh = false) => {
    let cancelled = false;
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setErrors({});

    Promise.allSettled([
      fetchFilesProcessedToday(),
      fetchOverallSentiment(),
      fetchSentimentTimeline(24),
      fetchSentimentDistribution(),
    ]).then(([filesRes, sentimentRes, timelineRes, distRes]) => {
      if (cancelled) return;
      const errs = {};

      // ── Files Processed Today ─────────────────────────────────────────
      if (filesRes.status === 'fulfilled') {
        const count = filesRes.value;
        setFilesKPI({
          title:         'Files Processed Today',
          value:         count.toLocaleString(),
          change:        count > 0 ? `${count} files analyzed` : 'No files today',
          changeType:    count > 0 ? 'positive' : 'neutral',
          icon:          'FileCheck',
          sparklineData: [],
        });
      } else {
        errs.files = filesRes.reason?.message;
        console.warn('[Overview] files fetch failed:', filesRes.reason);
      }

      // ── Overall Sentiment ───────────────────────────────────────────────────
      if (sentimentRes.status === 'fulfilled') {
        const s = sentimentRes.value;
        // Icon & color based on dominant sentiment
        const iconMap = { Satisfied: 'Smile', Neutral: 'Meh', Frustrated: 'Frown', Angry: 'Angry' };
        const typeMap = { Satisfied: 'positive', Neutral: 'neutral', Frustrated: 'negative', Angry: 'negative' };
        setSentimentKPI({
          title:         'Overall Sentiment',
          value:         s ? s.label : 'N/A',
          change:        s ? `${s.percentage}% of ${s.total} calls` : 'No data yet',
          changeType:    s ? (typeMap[s.label] ?? 'neutral') : 'neutral',
          icon:          s ? (iconMap[s.label] ?? 'SmilePlus') : 'SmilePlus',
          sparklineData: [],
        });
      } else {
        errs.sentiment = sentimentRes.reason?.message;
        console.warn('[Overview] overall sentiment fetch failed:', sentimentRes.reason);
      }

      // ── Emotion Timeline ──────────────────────────────────────────────
      if (timelineRes.status === 'fulfilled') {
        setTimelineData(timelineRes.value);
      } else {
        errs.timeline = timelineRes.reason?.message;
        console.warn('[Overview] timeline fetch failed:', timelineRes.reason);
      }

      // ── Emotion Distribution ──────────────────────────────────────────
      if (distRes.status === 'fulfilled') {
        setDistribution(distRes.value);
      } else {
        errs.distribution = distRes.reason?.message;
        console.warn('[Overview] distribution fetch failed:', distRes.reason);
      }

      setErrors(errs);
      setLastUpdated(new Date());
    }).finally(() => {
      if (!cancelled) {
        setLoading(false);
        setRefreshing(false);
      }
    });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const cleanup = loadData();
    return cleanup;
  }, [loadData]);

  const handleRefresh = () => loadData(true);

  const formatTime = (date) =>
    date?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const hasError = Object.keys(errors).length > 0;

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="container mx-auto p-6 max-w-[1400px]">

          {/* ── Page Header ──────────────────────────────────────────────── */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">
                Post-Call Analytics
              </h1>
              <p className="text-muted-foreground text-sm">
                Real-time sentiment monitoring and call analysis dashboard
              </p>
            </div>

            <div className="flex items-center gap-3 mt-1 flex-shrink-0">
              {lastUpdated && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Updated {formatTime(lastUpdated)}
                </span>
              )}
              {loading && !refreshing && (
                <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
              )}
              {hasError && (
                <span className="text-xs text-amber-500 flex items-center gap-1">
                  <Icon name="AlertTriangle" size={13} />
                  Some data unavailable
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

          {/* ── KPI Cards ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <KPICard {...filesKPI} />
            <KPICard {...sentimentKPI} />
          </div>

          {/* ── Real-Time Emotion Timeline ────────────────────────────────── */}
          <div className="mb-6">
            <SentimentTimelineChart data={timelineData} />
            {errors.timeline && (
              <p className="text-xs text-destructive mt-2 px-1">
                ⚠ Timeline: {errors.timeline}
              </p>
            )}
          </div>

          {/* ── Emotion Distribution ──────────────────────────────────────── */}
          <div className="mb-6">
            <SentimentDistributionChart
              data={distributionData}
              onDrillDown={(s) => console.log('Drill down:', s)}
            />
            {errors.distribution && (
              <p className="text-xs text-destructive mt-2 px-1">
                ⚠ Distribution: {errors.distribution}
              </p>
            )}
          </div>

        </div>
      </main>
    </>
  );
};

export default SentimentOverview;
