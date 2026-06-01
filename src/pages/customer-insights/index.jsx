import React, { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import FilterPanel from './components/FilterPanel';
import SentimentHeatmap from './components/SentimentHeatmap';
import SentimentAlertFeed from './components/SentimentAlertFeed';
import TopicBubbleChart from './components/TopicBubbleChart';
import KeywordWordCloud from './components/KeywordWordCloud';
import TrendAlertWidget from './components/TrendAlertWidget';
import Icon from '../../components/AppIcon';
import {
  fetchSentimentHeatmap,
  fetchSentimentAlerts,
  fetchTopicFrequency,
  fetchKeywords,
  fetchTrendAlerts,
} from '../../services/customerInsightsService';

const CustomerInsights = () => {
  const [lastUpdate, setLastUpdate]         = useState(new Date());
  const [filters, setFilters]               = useState({ segment: 'all', interactionType: 'all', sentimentThreshold: 'all', period: '30d' });
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
      const [heat, alts, tops, kws, trends] = await Promise.all([
        fetchSentimentHeatmap(),
        fetchSentimentAlerts(),
        fetchTopicFrequency(),
        fetchKeywords(),
        fetchTrendAlerts(),
      ]);
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
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(loadData, 300000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const handleResetFilters  = () => setFilters({ segment: 'all', interactionType: 'all', sentimentThreshold: 'all', period: '30d' });


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

          <FilterPanel filters={filters} onFilterChange={handleFilterChange} onResetFilters={handleResetFilters} />


          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-500/20 rounded-lg p-2"><Icon name="BarChart3" size={24} className="text-blue-400" /></div>
              <div>
                <h2 className="text-2xl font-bold text-white">Topic &amp; Keyword Trends</h2>
                <p className="text-slate-400 text-sm">AI-powered analysis of recurring patterns across all processed calls</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2"><TopicBubbleChart topics={topics} loading={loading} error={error} /></div>
              <div className="lg:col-span-1"><TrendAlertWidget alerts={trendAlerts} /></div>
            </div>
            <div className="mb-6"><KeywordWordCloud keywords={keywords} loading={loading} error={error} /></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2"><SentimentHeatmap heatmapData={heatmap} /></div>
            <div className="lg:col-span-1"><SentimentAlertFeed alerts={alerts} /></div>
          </div>

        </div>
      </main>
    </>
  );
};

export default CustomerInsights;