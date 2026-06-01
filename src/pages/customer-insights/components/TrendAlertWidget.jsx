import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchRisingTopics } from '../../../services/customerInsightsService';

// ── Polling interval: 60 seconds ──────────────────────────────────────────────
const POLL_INTERVAL_MS = 60_000;

// ── Severity icon mapping ─────────────────────────────────────────────────────
const SEVERITY_ICONS = {
  CRITICAL: 'AlertOctagon',
  HIGH:     'AlertTriangle',
  MEDIUM:   'AlertCircle',
  LOW:      'Info',
};

// ── Component ─────────────────────────────────────────────────────────────────
const TrendAlertWidget = () => {
  const [topics,      setTopics]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLive,      setIsLive]      = useState(false);
  const timerRef = useRef(null);

  // ── Fetch from Voice Analysis pipeline ─────────────────────────────────────
  const loadTopics = useCallback(async () => {
    try {
      const data = await fetchRisingTopics(5);
      setTopics(data);
      setIsLive(data.length > 0);
      setError(null);
    } catch (err) {
      setError(err.message ?? 'Failed to load rising topics');
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  // ── Initial load + live polling ────────────────────────────────────────────
  useEffect(() => {
    loadTopics();
    timerRef.current = setInterval(loadTopics, POLL_INTERVAL_MS);
    return () => clearInterval(timerRef.current);
  }, [loadTopics]);

  // ── Formatted last-updated time ────────────────────────────────────────────
  const lastUpdatedText = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—';

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 h-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-2">Rising Topics</h3>
          <p className="text-slate-400 text-sm">Voice Analysis · real-time severity</p>
        </div>
        <button
          onClick={() => { setLoading(true); loadTopics(); }}
          className="bg-rose-500/20 rounded-full p-2 hover:bg-rose-500/30 transition-all"
          title="Refresh now"
        >
          <Icon name={loading ? 'Loader2' : 'TrendingUp'} size={20} className={`text-rose-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Error state ── */}
      {error && !loading && (
        <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg mb-4">
          <Icon name="AlertTriangle" size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-rose-400">{error}</p>
        </div>
      )}

      {/* ── Skeleton loading ── */}
      {loading && topics.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-700/30 border border-slate-700 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-slate-600/50 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-slate-600/50 rounded w-2/3" />
                  <div className="h-2 bg-slate-600/40 rounded w-1/2" />
                </div>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-slate-600/50 rounded-full w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && topics.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <Icon name="BarChart2" size={30} className="text-slate-500" />
          <p className="text-sm text-slate-400">No topics detected yet</p>
          <p className="text-xs text-slate-500">Topics appear once calls are processed by Voice Analysis</p>
        </div>
      )}

      {/* ── Topic cards ── */}
      {topics.length > 0 && (
        <div className="divide-y divide-border max-h-[380px] overflow-y-auto">
          <div className="space-y-3 pr-1">
            {topics.map(t => (
              <div
                key={t.id}
                className={`${t.bgColor} ${t.borderColor} border rounded-lg p-4 hover:shadow-lg transition-all duration-200`}
              >
                {/* Top row: icon + name + severity icon */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`${t.bgColor} rounded-lg p-2`}>
                      <Icon name={t.icon} size={18} className={t.textColor} />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{t.topic}</h4>
                      <p className="text-slate-400 text-xs mt-0.5">
                        {t.count} mention{t.count !== 1 ? 's' : ''} in {t.timeframe ?? 'recent period'}
                      </p>
                    </div>
                  </div>
                  <Icon name={SEVERITY_ICONS[t.severity] ?? 'Info'} size={16} className={t.textColor} />
                </div>

                {/* Severity score bar */}
                <div className="mb-2">
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        t.severity === 'CRITICAL' ? 'bg-rose-500'   :
                        t.severity === 'HIGH'     ? 'bg-orange-500' :
                        t.severity === 'MEDIUM'   ? 'bg-amber-500'  : 'bg-blue-500'
                      }`}
                      style={{ width: `${t.severityScore}%` }}
                    />
                  </div>
                </div>

                {/* Bottom row: score + severity badge */}
                <div className="flex items-center justify-between">
                  <span className={`${t.textColor} text-sm font-bold`}>
                    {t.severityScore}% severity score
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${t.textColor} ${t.badgeBg}`}>
                    {t.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400 text-xs">Updated {lastUpdatedText}</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${isLive ? 'bg-emerald-500' : 'bg-slate-500'}`} />
            <span className="text-slate-300 font-medium text-xs">
              {isLive ? 'Live · Voice Analysis' : 'No data'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendAlertWidget;