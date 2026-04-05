import React, { useState, useEffect } from 'react';
import Icon from './AppIcon';
import { checkGeminiConnection, analyzeSentiment, generateCallSummary } from '../services/geminiService';

const GeminiAnalysisPanel = ({ transcript = '', callMeta = {}, onAnalysisComplete }) => {
  const [status,    setStatus]    = useState('idle'); // idle | testing | analyzing | done | error
  const [connected, setConnected] = useState(null);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState(null);
  const [customText,setCustomText]= useState('');

  // Auto-check connection on mount
  useEffect(() => {
    handleTestConnection();
  }, []); // eslint-disable-line

  const handleTestConnection = async () => {
    setStatus('testing');
    setError(null);
    const check = await checkGeminiConnection();
    setConnected(check.connected);
    setStatus('idle');
    if (!check.connected) setError(check.error);
  };

  const handleAnalyze = async () => {
    const text = customText.trim() || transcript.trim();
    if (!text) { setError('أدخل نص المحادثة أولاً.'); return; }

    setStatus('analyzing');
    setError(null);
    setResult(null);

    try {
      const [sentimentData, summaryData] = await Promise.all([
        analyzeSentiment(text),
        generateCallSummary(text, callMeta),
      ]);
      setResult({ sentiment: sentimentData, summary: summaryData });
      setStatus('done');
      onAnalysisComplete?.({ sentiment: sentimentData, summary: summaryData });
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  const SENTIMENT_COLORS = {
    satisfied:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: 'Smile'       },
    neutral:    { bg: 'bg-slate-500/10',   text: 'text-slate-400',   border: 'border-slate-500/30',   icon: 'Minus'       },
    frustrated: { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/30',   icon: 'Frown'       },
    angry:      { bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'border-rose-500/30',    icon: 'AlertCircle' },
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-border bg-gradient-to-r from-blue-500/5 to-purple-500/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Icon name="Sparkles" size={20} color="white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Gemini AI Analysis</h3>
            <p className="text-xs text-muted-foreground">Powered by Google Gemini 2.0 Flash</p>
          </div>
        </div>

        {/* Connection badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
          status === 'testing'       ? 'bg-muted border-border text-muted-foreground animate-pulse' :
          connected === true         ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
          connected === false        ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                                       'bg-muted border-border text-muted-foreground'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            status === 'testing' ? 'bg-yellow-400 animate-pulse' :
            connected === true   ? 'bg-emerald-400' :
            connected === false  ? 'bg-rose-400' : 'bg-slate-400'
          }`} />
          {status === 'testing' ? 'Connecting…' : connected === true ? 'Connected' : connected === false ? 'Disconnected' : 'Checking…'}
        </div>
      </div>

      <div className="p-5 space-y-4">

        {/* API Key Warning */}
        {connected === false && (
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <Icon name="AlertTriangle" size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-400">مفتاح API غير مُعيَّن</p>
              <p className="text-xs text-muted-foreground mt-1">
                أضف مفتاح Gemini في ملف <code className="bg-muted px-1 rounded">.env</code>:
              </p>
              <code className="text-xs text-amber-300 block mt-1 bg-muted p-2 rounded font-mono">
                VITE_GEMINI_API_KEY=AIza...
              </code>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer"
                className="text-xs text-blue-400 hover:underline mt-2 inline-flex items-center gap-1">
                <Icon name="ExternalLink" size={12} />
                احصل على مفتاح API مجاناً
              </a>
            </div>
          </div>
        )}

        {/* Custom text input */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">
            نص المحادثة للتحليل {transcript ? '(أو اكتب نصًا مخصصاً)' : '(أدخل نص المحادثة)'}
          </label>
          <textarea
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder={transcript || 'اكتب أو الصق نص المحادثة هنا…'}
            rows={3}
            className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
          />
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={status === 'analyzing' || status === 'testing' || connected === false}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
        >
          {status === 'analyzing' ? (
            <><Icon name="Loader2" size={16} className="animate-spin" /> جارٍ التحليل…</>
          ) : (
            <><Icon name="Sparkles" size={16} /> تحليل بـ Gemini AI</>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <Icon name="AlertCircle" size={16} className="text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 pt-2 border-t border-border">

            {/* Sentiment Result */}
            {result.sentiment && (() => {
              const s   = result.sentiment.sentiment ?? 'neutral';
              const cfg = SENTIMENT_COLORS[s] ?? SENTIMENT_COLORS.neutral;
              return (
                <div className={`p-4 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon name={cfg.icon} size={18} className={cfg.text} />
                      <span className={`text-sm font-semibold capitalize ${cfg.text}`}>{s}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Score: <b className="text-foreground">{result.sentiment.sentiment_score}%</b></span>
                      <span>Conf: <b className="text-foreground">{result.sentiment.sentiment_confidence}%</b></span>
                    </div>
                  </div>

                  {/* Emotion bars */}
                  <div className="space-y-1.5">
                    {Object.entries(result.sentiment.emotion_breakdown ?? {}).map(([emo, val]) => (
                      <div key={emo} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16 capitalize">{emo}</span>
                        <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              emo === 'satisfied'  ? 'bg-emerald-500' :
                              emo === 'neutral'    ? 'bg-slate-500'   :
                              emo === 'frustrated' ? 'bg-amber-500'   : 'bg-rose-500'
                            }`}
                            style={{ width: `${val}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{val}%</span>
                      </div>
                    ))}
                  </div>

                  {result.sentiment.reasoning && (
                    <p className="text-xs text-muted-foreground mt-3 italic">
                      {result.sentiment.reasoning}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Summary */}
            {result.summary?.summary && (
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="FileText" size={16} className="text-blue-400" />
                  <span className="text-xs font-semibold text-blue-400">AI Summary</span>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                    result.summary.resolution_status === 'resolved'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {result.summary.resolution_status?.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{result.summary.summary}</p>
                {result.summary.key_points?.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {result.summary.key_points.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Icon name="ChevronRight" size={12} className="mt-0.5 text-blue-400 flex-shrink-0" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};

export default GeminiAnalysisPanel;
