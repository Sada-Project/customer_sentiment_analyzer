import React, { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import MetricCard from './components/MetricCard';
import FilterPanel from './components/FilterPanel';
import SentimentHeatmap from './components/SentimentHeatmap';
import SentimentAlertFeed from './components/SentimentAlertFeed';
import CustomerSentimentTable from './components/CustomerSentimentTable';
import TopicBubbleChart from './components/TopicBubbleChart';
import KeywordWordCloud from './components/KeywordWordCloud';
import TrendAlertWidget from './components/TrendAlertWidget';
import Icon from '../../components/AppIcon';
import {
  fetchCustomers,
  fetchCustomerMetrics,
  fetchSentimentHeatmap,
  fetchSentimentAlerts,
  fetchTopicFrequency,
  fetchKeywords,
  fetchTrendAlerts,
} from '../../services/customerInsightsService';

const CustomerInsights = () => {
  const [lastUpdate, setLastUpdate]         = useState(new Date());
  const [filters, setFilters]               = useState({ segment: 'all', interactionType: 'all', sentimentThreshold: 'all', period: '30d' });
  const [customers, setCustomers]           = useState([]);
  const [metrics, setMetrics]               = useState([]);
  const [heatmap, setHeatmap]               = useState([]);
  const [alerts, setAlerts]                 = useState([]);
  const [topics, setTopics]                 = useState([]);
  const [keywords, setKeywords]             = useState([]);
  const [trendAlerts, setTrendAlerts]       = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [cust, met, heat, alts, tops, kws, trends] = await Promise.all([
        fetchCustomers({ segment: filters.segment, interactionType: filters.interactionType, sentimentThreshold: filters.sentimentThreshold }),
        fetchCustomerMetrics(),
        fetchSentimentHeatmap(),
        fetchSentimentAlerts(),
        fetchTopicFrequency(),
        fetchKeywords(),
        fetchTrendAlerts(),
      ]);
      setCustomers(cust);
      setMetrics(met);
      setHeatmap(heat);
      setAlerts(alts);
      setTopics(tops);
      setKeywords(kws);
      setTrendAlerts(trends);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters.segment, filters.interactionType, filters.sentimentThreshold]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const handleApplyFilters  = () => loadData();
  const handleResetFilters  = () => setFilters({ segment: 'all', interactionType: 'all', sentimentThreshold: 'all', period: '30d' });

  // Map DB metric rows → MetricCard props
  const metricsData = metrics.length > 0
    ? metrics.map(row => ({
        title:      row.metric_label,
        value:      row.metric_unit === '%'
          ? `${Number(row.metric_value).toFixed(1)}%`
          : Number(row.metric_value).toLocaleString(),
        change:     row.change_value != null ? `${row.change_value > 0 ? '+' : ''}${Number(row.change_value).toFixed(1)}%` : '—',
        changeType: row.change_type ?? 'neutral',
        icon:       row.metric_key === 'satisfaction_trend' ? 'Heart' : 'TrendingUp',
        iconColor:  row.metric_key === 'satisfaction_trend' ? 'var(--color-success)' : 'var(--color-primary)',
      }))
    : [
        { title: 'Customer Satisfaction Score', value: '78.5%', change: '+5.2%', changeType: 'positive', icon: 'Heart',      iconColor: 'var(--color-success)' },
        { title: 'Sentiment Velocity',           value: '+12.3%', change: '+3.1%', changeType: 'positive', icon: 'TrendingUp', iconColor: 'var(--color-primary)' },
      ];

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="container mx-auto p-6">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Customer Insights</h1>
              <p className="text-muted-foreground">Strategic analytics for business decision-making with advanced filtering</p>
            </div>
            <div className="flex items-center gap-3">
              {loading && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
              {error   && <span className="text-xs text-destructive">⚠ {error}</span>}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon name="Clock" size={16} />
                <span>Last updated: {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>

          <FilterPanel filters={filters} onFilterChange={handleFilterChange} onApplyFilters={handleApplyFilters} onResetFilters={handleResetFilters} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {metricsData.map((metric) => <MetricCard key={metric.title} {...metric} />)}
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-500/20 rounded-lg p-2"><Icon name="BarChart3" size={24} className="text-blue-400" /></div>
              <div>
                <h2 className="text-2xl font-bold text-white">Topic &amp; Keyword Trends</h2>
                <p className="text-slate-400 text-sm">AI-powered analysis of recurring patterns across all processed calls</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2"><TopicBubbleChart topics={topics} /></div>
              <div className="lg:col-span-1"><TrendAlertWidget alerts={trendAlerts} /></div>
            </div>
            <div className="mb-6"><KeywordWordCloud keywords={keywords} /></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2"><SentimentHeatmap heatmapData={heatmap} /></div>
            <div className="lg:col-span-1"><SentimentAlertFeed alerts={alerts} /></div>
          </div>

          <div><CustomerSentimentTable customers={customers} /></div>
        </div>
      </main>
    </>
  );
};

export default CustomerInsights;