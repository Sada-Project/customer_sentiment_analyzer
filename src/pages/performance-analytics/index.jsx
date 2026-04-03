import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import MetricCard from './components/MetricCard';
import PerformanceChart from './components/PerformanceChart';
import SystemHealthGauge from './components/SystemHealthGauge';
import AlertPanel from './components/AlertPanel';
import ConnectionStatus from './components/ConnectionStatus';
import {
  fetchPerformanceKPIs,
  fetchPerformanceMetrics,
  fetchSystemHealth,
  fetchPerformanceAlerts,
} from '../../services/performanceAnalyticsService';

// KPI icon/threshold config per metric_key
const METRIC_CONFIG = {
  processing_accuracy:   { icon: 'Target',        iconColor: 'var(--color-success)', threshold: 97.0,  unit: '%'   },
  transcription_confidence: { icon: 'Target',     iconColor: 'var(--color-success)', threshold: 95.0,  unit: '%'   },
  sentiment_confidence:  { icon: 'TrendingUp',    iconColor: 'var(--color-warning)', threshold: 90.0,  unit: '%'   },
  script_adherence:      { icon: 'ClipboardCheck', iconColor: 'var(--color-success)', threshold: 85.0, unit: '%'   },
  processing_speed:      { icon: 'Zap',           iconColor: 'var(--color-primary)', threshold: 3.0,   unit: 'sec/file' },
};

const CHART_METRICS = [
  { key: 'filesUploaded',   label: 'Files Uploaded',   color: 'var(--color-primary)',  unit: ' files' },
  { key: 'filesProcessed',  label: 'Files Processed',  color: 'var(--color-success)',  unit: ' files' },
  { key: 'accuracy',        label: 'Accuracy',          color: 'var(--color-warning)',  unit: '%'      },
  { key: 'scriptAdherence', label: 'Script Adherence',  color: '#8b5cf6',               unit: '%'      },
];

const PerformanceAnalytics = () => {
  const [kpiMetrics,    setKpiMetrics]   = useState([]);
  const [chartData,     setChartData]    = useState([]);
  const [systemHealth,  setSystemHealth] = useState([]);
  const [alerts,        setAlerts]       = useState([]);
  const [isConnected,   setIsConnected]  = useState(true);
  const [loading,       setLoading]      = useState(true);
  const [error,         setError]        = useState(null);
  const [lastUpdate,    setLastUpdate]   = useState('just now');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchPerformanceKPIs(),
      fetchPerformanceMetrics(24),
      fetchSystemHealth(),
      fetchPerformanceAlerts(5),
    ])
      .then(([kpis, chart, health, alts]) => {
        if (cancelled) return;
        setIsConnected(true);

        // Map KPI rows to MetricCard format
        if (kpis.length > 0) {
          setKpiMetrics(kpis.map(row => {
            const cfg = METRIC_CONFIG[row.metric_key] ?? {};
            return {
              title:      row.metric_label,
              value:      row.metric_unit === '%' ? Number(row.metric_value).toFixed(1) : Number(row.metric_value).toFixed(2),
              unit:       cfg.unit ?? row.metric_unit ?? '',
              change:     row.change_value != null ? Number(row.change_value) : 0,
              changeType: row.change_type ?? 'neutral',
              icon:       cfg.icon ?? 'BarChart2',
              iconColor:  cfg.iconColor ?? 'var(--color-primary)',
              threshold:  cfg.threshold,
            };
          }));
        }

        if (chart.length > 0) setChartData(chart);
        if (health.length > 0) setSystemHealth(health.map(row => ({
          title:      row.metric_label,
          value:      Number(row.current_value),
          max:        Number(row.max_value),
          unit:       row.unit,
          icon:       row.icon_name ?? 'Activity',
          thresholds: { warning: row.warning_threshold, critical: row.critical_threshold },
        })));
        if (alts.length > 0) setAlerts(alts);
        setLastUpdate('just now');
      })
      .catch(err => {
        if (!cancelled) { setError(err.message); setIsConnected(false); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // Update "X seconds ago" label
  useEffect(() => {
    const interval = setInterval(() => {
      const s = new Date().getSeconds();
      setLastUpdate(`${s}s ago`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fallback KPIs if DB empty
  const displayKPIs = kpiMetrics.length > 0 ? kpiMetrics : [
    { title: 'Processing Speed',         value: '2.3',  unit: 'sec/file', change: -12, changeType: 'negative', icon: 'Zap',           iconColor: 'var(--color-primary)', threshold: 3.0  },
    { title: 'Transcription Confidence', value: '96.8', unit: '%',        change: 2.4, changeType: 'positive', icon: 'Target',        iconColor: 'var(--color-success)', threshold: 95.0 },
    { title: 'Sentiment Confidence',     value: '94.2', unit: '%',        change: 1.8, changeType: 'positive', icon: 'TrendingUp',    iconColor: 'var(--color-warning)', threshold: 90.0 },
    { title: 'Script Adherence Rate',    value: '91.5', unit: '%',        change: 3.2, changeType: 'positive', icon: 'ClipboardCheck', iconColor: 'var(--color-success)', threshold: 85.0 },
  ];

  const displayChart = chartData.length > 0 ? chartData : [
    { time: '00:00', filesUploaded: 156, filesProcessed: 145, accuracy: 96.2, scriptAdherence: 89.5 },
    { time: '04:00', filesUploaded: 95,  filesProcessed: 89,  accuracy: 96.5, scriptAdherence: 90.2 },
    { time: '08:00', filesUploaded: 342, filesProcessed: 312, accuracy: 95.8, scriptAdherence: 88.7 },
    { time: '12:00', filesUploaded: 468, filesProcessed: 428, accuracy: 96.1, scriptAdherence: 91.8 },
    { time: '16:00', filesUploaded: 421, filesProcessed: 389, accuracy: 96.9, scriptAdherence: 92.4 },
    { time: '20:00', filesUploaded: 289, filesProcessed: 267, accuracy: 97.2, scriptAdherence: 93.1 },
  ];

  const displayHealth = systemHealth.length > 0 ? systemHealth : [
    { title: 'Memory',       value: 12.4, max: 16,  unit: 'GB', icon: 'HardDrive', thresholds: { warning: 75, critical: 90 } },
    { title: 'API Response', value: 142,  max: 500, unit: 'ms', icon: 'Gauge',     thresholds: { warning: 60, critical: 80 } },
  ];

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="container mx-auto p-6">

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Post-Call Performance Analytics</h1>
              <p className="text-muted-foreground">Batch processing monitoring for system efficiency and AI model accuracy</p>
            </div>
            <div className="flex items-center gap-3">
              {loading && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
              {error   && <span className="text-xs text-destructive">⚠ {error}</span>}
              <ConnectionStatus isConnected={isConnected} lastUpdate={lastUpdate} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {displayKPIs.map((metric) => <MetricCard key={metric.title} {...metric} />)}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            <div className="lg:col-span-9">
              <PerformanceChart data={displayChart} metrics={CHART_METRICS} />
            </div>
            <div className="lg:col-span-3 space-y-4">
              {displayHealth.map((h, i) => <SystemHealthGauge key={i} {...h} />)}
            </div>
          </div>

          {alerts.length > 0 && (
            <div className="mb-6">
              <AlertPanel alerts={alerts} />
            </div>
          )}

        </div>
      </main>
    </>
  );
};

export default PerformanceAnalytics;