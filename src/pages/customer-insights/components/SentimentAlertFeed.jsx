import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { extractProblemAndSolution } from '../../../services/geminiService';
import { getCachedPS, setCachedPS } from '../../../services/callDetailsService';

// ── Config maps ───────────────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  billing:   { icon: 'DollarSign',  color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
  technical: { icon: 'Wrench',      color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20'    },
  service:   { icon: 'Headphones',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  product:   { icon: 'Package',     color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20'  },
  account:   { icon: 'User',        color: 'text-sky-400',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20'     },
  other:     { icon: 'AlertCircle', color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20'   },
};

const SEVERITY_CONFIG = {
  low:      { label: 'Low',      color: 'text-slate-400',   bg: 'bg-slate-500/10'  },
  medium:   { label: 'Medium',   color: 'text-amber-400',   bg: 'bg-amber-500/10'  },
  high:     { label: 'High',     color: 'text-orange-400',  bg: 'bg-orange-500/10' },
  critical: { label: 'Critical', color: 'text-rose-400',    bg: 'bg-rose-500/10'   },
};

const SOLUTION_TYPES = {
  immediate_action: { icon: 'Zap',          label: 'Immediate Action' },
  escalation:       { icon: 'ArrowUpRight', label: 'Escalation'       },
  follow_up:        { icon: 'Calendar',     label: 'Follow-up'        },
  information:      { icon: 'Info',         label: 'Information'      },
  refund:           { icon: 'RefreshCw',    label: 'Refund'           },
  technical_fix:    { icon: 'Wrench',       label: 'Technical Fix'    },
};

// ── Component ─────────────────────────────────────────────────────────────────
const SentimentAlertFeed = ({ transcript = [], transcriptText = '', loading: parentLoading = false, callId = null }) => {
  const [result,   setResult]   = useState(null);
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState(null);

  // Build plain text from transcript segments, or use the passed string
  const buildText = useCallback(() => {
    if (transcriptText) return transcriptText;
    return transcript
      .map(s => `${s.speaker === 'agent' ? 'Agent' : 'Customer'}: ${s.message}`)
      .join('\n')
      .trim();
  }, [transcript, transcriptText]);

  const runAnalysis = useCallback(() => {
    const text = buildText();
    if (!text) return;
    setFetching(true);
    setFetchErr(null);
    setResult(null);
    extractProblemAndSolution(text)
      .then(r  => setResult(r))
      .catch(e => setFetchErr(e.message ?? 'Analysis failed'))
      .finally(() => setFetching(false));
  }, [buildText]);

  // Auto-run when transcript becomes available
  // Delayed by 4s to stagger Gemini API calls (topics=0s, compliance=2s, this=4s)
  useEffect(() => {
    if (parentLoading) return;

    // ✅ Load from localStorage cache first — instant, no Gemini call
    if (callId) {
      const cached = getCachedPS(callId);
      if (cached) { setResult(cached); return; }
    }

    const timer = setTimeout(() => {
      const text = buildText();
      if (!text) return;
      setFetching(true);
      setFetchErr(null);
      setResult(null);
      extractProblemAndSolution(text)
        .then(r => {
          setResult(r);
          // 💾 Cache to localStorage for next visit
          if (r && callId) setCachedPS(callId, r);
        })
        .catch(e => setFetchErr(e.message ?? 'Analysis failed'))
        .finally(() => setFetching(false));
    }, 4000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, transcriptText, parentLoading]);

  const catCfg  = CATEGORY_CONFIG[result?.problem_category] ?? CATEGORY_CONFIG.other;
  const sevCfg  = SEVERITY_CONFIG[result?.severity]          ?? SEVERITY_CONFIG.medium;
  const solType = SOLUTION_TYPES[result?.solution_type]      ?? SOLUTION_TYPES.information;

  return (
    <div className="bg-card rounded-lg p-6 border border-border">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Icon name="AlertCircle" size={20} />
            Problem &amp; Solution
          </h2>
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium">
            <Icon name="Sparkles" size={11} />
            Gemini AI
          </span>
        </div>
        <button
          onClick={runAnalysis}
          disabled={fetching}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all disabled:opacity-40"
          title="Re-analyze"
        >
          <Icon name="RefreshCw" size={14} className={fetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Loading ── */}
      {(fetching || parentLoading) && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
            <div className="absolute inset-0 rounded-full border-t-2 border-violet-500 animate-spin" />
            <Icon name="Sparkles" size={18} className="absolute inset-0 m-auto text-violet-400" />
          </div>
          <p className="text-xs text-muted-foreground animate-pulse">Gemini is analyzing the call…</p>
        </div>
      )}

      {/* ── Error ── */}
      {!fetching && !parentLoading && fetchErr && (
        <div className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
          <Icon name="AlertTriangle" size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-rose-400 mb-1">Analysis failed</p>
            <p className="text-xs text-rose-400/80">{fetchErr}</p>
          </div>
        </div>
      )}

      {/* ── No result ── */}
      {!fetching && !parentLoading && !fetchErr && !result && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
          <Icon name="MessageSquareOff" size={30} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {buildText() ? 'No issues detected in this call' : 'No transcript available to analyze'}
          </p>
        </div>
      )}

      {/* ── Result ── */}
      {!fetching && !parentLoading && result && (
        <div className="space-y-4">

          {/* Severity + category badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${sevCfg.bg} ${sevCfg.color}`}>
              ● {sevCfg.label} Severity
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${catCfg.bg} ${catCfg.color}`}>
              {result.problem_category?.charAt(0).toUpperCase() + result.problem_category?.slice(1)}
            </span>
          </div>

          {/* Problem */}
          <div className={`rounded-xl border p-4 ${catCfg.bg} ${catCfg.border}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-full ${catCfg.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon name={catCfg.icon} size={15} className={catCfg.color} />
              </div>
              <p className={`text-xs font-bold uppercase tracking-wide ${catCfg.color}`}>
                Problem Detected
              </p>
            </div>
            <p className="text-sm text-foreground leading-relaxed ml-9">
              {result.problem}
            </p>
          </div>

          {/* Solution */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Icon name={solType.icon} size={15} className="text-emerald-400" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-400">
                Recommended Solution
              </p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
                {solType.label}
              </span>
            </div>
            <p className="text-sm text-foreground leading-relaxed ml-9">
              {result.solution}
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-5 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Icon name="Sparkles" size={11} className="text-violet-400" />
          Problem and solution extracted by Gemini AI from call transcript
        </p>
      </div>
    </div>
  );
};

export default SentimentAlertFeed;