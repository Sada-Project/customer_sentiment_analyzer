import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import SentimentAlertFeed from '../customer-insights/components/SentimentAlertFeed';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '../../lib/supabase';
import { extractTopics, checkScriptCompliance } from '../../services/geminiService';


import {
  fetchCallById,
  fetchCallByRef,
  fetchTranscript,
  fetchCallTopics,
  fetchCallQA,
} from '../../services/callDetailsService';

const TALK_RATIO_COLORS = { agent: '#3b82f6', customer: '#64748b' };

const CallDetails = () => {
  const { callId } = useParams();
  const navigate   = useNavigate();

  const [callData,       setCallData]       = useState(null);
  const [transcript,     setTranscript]     = useState([]);
  const [topics,         setTopics]         = useState([]);
  const [qaResults,      setQaResults]      = useState([]);
  const [callAlerts,     setCallAlerts]     = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  // AI-extracted topics
  const [aiTopics,       setAiTopics]       = useState([]);
  const [topicsLoading,  setTopicsLoading]  = useState(false);
  const [topicsError,    setTopicsError]    = useState(null);
  // AI script compliance
  const [qaAI,           setQaAI]           = useState([]);
  const [qaLoading,      setQaLoading]      = useState(false);
  const [qaError,        setQaError]        = useState(null);

  useEffect(() => {
    if (!callId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Try UUID first, then call_ref
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(callId);
    const fetchCall = isUUID ? fetchCallById(callId) : fetchCallByRef(callId);

    fetchCall
      .then(async call => {
        if (cancelled || !call) return;
        setCallData(call);
        const [trans, tops, qa, alertsRes] = await Promise.all([
          fetchTranscript(call.id),
          fetchCallTopics(call.id),
          fetchCallQA(call.id),
          // Fetch alerts linked to this specific call recording
          supabase
            .from('alerts')
            .select('*')
            .or(`call_recording_id.eq.${call.id},description.ilike.%${call.call_ref ?? ''}%`)
            .order('created_at', { ascending: false })
            .limit(10),
        ]);
        if (cancelled) return;
        setTranscript(trans);
        setTopics(tops);
        setQaResults(qa);
        setCallAlerts(alertsRes.data ?? []);
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [callId]);

  const refreshAlerts = async () => {
    if (!callData?.id) return;
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .or(`call_recording_id.eq.${callData.id},description.ilike.%${callData.call_ref ?? ''}%`)
      .order('created_at', { ascending: false })
      .limit(10);
    setCallAlerts(data ?? []);
  };  // ── Auto-extract AI topics once transcript is available ──────────────────────
  useEffect(() => {
    // Build plain text from transcript segments
    const plainText = transcript
      .map(s => `${s.speaker}: ${s.message}`)
      .join('\n')
      .trim();

    // Also use callData.transcript_text as fallback
    const text = plainText || (callData?.transcript_text ?? '');
    if (!text || topicsLoading) return;

    setTopicsLoading(true);
    setTopicsError(null);
    extractTopics(text)
      .then(result => setAiTopics(Array.isArray(result) ? result : []))
      .catch(err   => setTopicsError(err.message ?? 'AI topics failed'))
      .finally(()  => setTopicsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, callData?.id]);

  // ── Auto-run Script Compliance check once transcript is available ────────────
  const QA_CRITERIA = [
    {
      id:          'greeting',
      title:       'Opening Greeting',
      description: 'Agent used a professional welcome/greeting phrase at the start of the call (e.g. "Thank you for calling", "How may I help you", "Good morning/afternoon", "Welcome", or similar).',
    },
    {
      id:          'closing',
      title:       'Closing Etiquette',
      description: 'Agent properly closed the call with a polite farewell or confirmation phrase (e.g. "Is there anything else I can help you with", "Thank you for calling", "Have a great day", or similar).',
    },
  ];

  const runComplianceCheck = (transcriptSegs, fallbackText) => {
    const plainText = transcriptSegs
      .map(s => `${s.speaker}: ${s.message}`)
      .join('\n')
      .trim();
    const text = plainText || (fallbackText ?? '');
    if (!text) return;
    setQaLoading(true);
    setQaError(null);
    checkScriptCompliance(text, QA_CRITERIA)
      .then(results => setQaAI(Array.isArray(results) ? results : []))
      .catch(err   => setQaError(err.message ?? 'Compliance check failed'))
      .finally(()  => setQaLoading(false));
  };

  useEffect(() => {
    if (!transcript.length && !callData?.transcript_text) return;
    runComplianceCheck(transcript, callData?.transcript_text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, callData?.id]);


  const getSentimentColor = s => ({ satisfied: 'bg-emerald-500', neutral: 'bg-slate-500', frustrated: 'bg-amber-500', angry: 'bg-rose-500' }[s] ?? 'bg-slate-500');
  const getSentimentBadge = s => {
    const map = {
      satisfied:  { bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: 'Smile'        },
      neutral:    { bg: 'bg-slate-500/10',   text: 'text-slate-600',   icon: 'Minus'        },
      frustrated: { bg: 'bg-amber-500/10',   text: 'text-amber-600',   icon: 'Frown'        },
      angry:      { bg: 'bg-rose-500/10',    text: 'text-rose-600',    icon: 'AlertCircle'  },
    };
    const b = map[s] ?? map.neutral;
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ${b.bg}`}>
        <Icon name={b.icon} size={16} className={b.text} />
        <span className={`text-sm font-medium ${b.text} capitalize`}>{s}</span>
      </div>
    );
  };

  // Loading state
  if (loading) return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Icon name="Loader2" size={40} className="text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading call details…</p>
        </div>
      </main>
    </>
  );

  // Error state
  if (error || !callData) return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Icon name="AlertCircle" size={40} className="text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground">{error ?? 'Call not found'}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </main>
    </>
  );

  const customer = callData.customers;
  const agent    = callData.agents;

  // ── Talk Ratio calculation ──────────────────────────────────────────────────
  // Priority 1: count words from actual transcript segments
  // Priority 2: use DB columns agent_talk_pct / customer_talk_pct
  // No hardcoded fallback — if no data available show 0/0
  let agentPct    = 0;
  let customerPct = 0;
  let talkSource  = null; // 'transcript' | 'database' | null

  // We'll compute this after displayTranscript is built (see below).
  // For now set placeholders; will be overwritten after transcript parsing.

  // Use DB smart topics or fallback
  const displayTopics = topics.length > 0 ? topics : [
    { tag: '#Billing', icon: 'DollarSign' }, { tag: '#Refund', icon: 'RefreshCw' }, { tag: '#AccountIssue', icon: 'AlertCircle' },
  ];

  // Use DB QA results or fallback
  const displayQA = qaResults.length > 0 ? qaResults : [
    { item: 'Opening Greeting', description: 'Verified standard welcome phrase used', status: 'pass', details: 'Agent: "Thank you for calling, how may I help you today?"' },
    { item: 'Closing Etiquette', description: 'Proper call closure with confirmation', status: 'pass', details: 'Agent: "Is there anything else I can help you with today?"' },
  ];

  // Build chat messages from DB segments OR fallback to transcript_text string
  let displayTranscript = [];
  if (transcript.length > 0) {
    displayTranscript = transcript.map(seg => ({
      speaker:   seg.speaker,
      message:   seg.message,
      sentiment: seg.sentiment ?? 'neutral',
      timestamp: seg.timestamp_offset ?? '00:00',
    }));
  } else if (callData?.transcript_text) {
    // Parse plain "Agent: …" / "Customer: …" lines
    displayTranscript = callData.transcript_text
      .split(/\n|(?=(?:Agent|Customer):\s)/)   // split on newlines or before "Agent:"
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, i) => {
        const agentMatch    = line.match(/^Agent:\s*(.*)/i);
        const customerMatch = line.match(/^Customer:\s*(.*)/i);
        if (agentMatch)    return { speaker: 'agent',    message: agentMatch[1],    sentiment: 'neutral', timestamp: '' };
        if (customerMatch) return { speaker: 'customer', message: customerMatch[1], sentiment: 'neutral', timestamp: '' };
        return { speaker: i % 2 === 0 ? 'agent' : 'customer', message: line, sentiment: 'neutral', timestamp: '' };
      });
  }

  // ── Compute talk ratio from transcript ──────────────────────────────────────
  // Count words spoken by each speaker in the transcript
  const wordCount = { agent: 0, customer: 0 };
  for (const msg of displayTranscript) {
    const words = (msg.message ?? '').trim().split(/\s+/).filter(Boolean).length;
    if (msg.speaker === 'agent')    wordCount.agent    += words;
    else if (msg.speaker === 'customer') wordCount.customer += words;
  }
  const totalWords = wordCount.agent + wordCount.customer;

  if (totalWords > 0) {
    // Calculated from real transcript
    agentPct    = Math.round((wordCount.agent    / totalWords) * 100);
    customerPct = Math.round((wordCount.customer / totalWords) * 100);
    talkSource  = 'transcript';
  } else if (callData.agent_talk_pct != null || callData.customer_talk_pct != null) {
    // Fall back to DB columns if transcript unavailable
    agentPct    = Math.round(callData.agent_talk_pct    ?? 0);
    customerPct = Math.round(callData.customer_talk_pct ?? 0);
    talkSource  = 'database';
  }
  // else: both stay 0 — no data available

  const talkData = [
    { speaker: 'Agent',    percentage: agentPct,    words: wordCount.agent,    color: TALK_RATIO_COLORS.agent    },
    { speaker: 'Customer', percentage: customerPct, words: wordCount.customer, color: TALK_RATIO_COLORS.customer },
  ];

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="container mx-auto p-6 max-w-[1400px]">

          {/* Back + Header */}
          <div className="mb-6">
            <Button variant="ghost" iconName="ArrowLeft" iconPosition="left" onClick={() => navigate(-1)} className="mb-4">
              Back to Dashboard
            </Button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Call Details</h1>
                <p className="text-muted-foreground">Comprehensive analysis and transcript review</p>
              </div>
            </div>
          </div>

          {/* Call Overview */}
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Customer</p>
                {(customer?.full_name ?? customer?.company_name) ? (
                  <>
                    <p className="text-base font-semibold text-foreground">{customer.full_name ?? customer.company_name}</p>
                    <p className="text-xs text-muted-foreground">{customer?.customer_ref ?? callData?.call_ref ?? '—'}</p>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Icon name="UserX" size={15} className="text-muted-foreground" />
                      <p className="text-base font-semibold text-muted-foreground">Unknown Customer</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{callData?.call_ref ?? '—'}</p>
                  </>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Agent</p>
                <p className="text-base font-semibold text-foreground">{agent?.name ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{agent?.role_title ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Overall Sentiment</p>
                {getSentimentBadge(callData.sentiment ?? 'neutral')}
                <p className="text-xs text-muted-foreground mt-1">{callData.sentiment_confidence ?? '—'}% confidence</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Call Duration</p>
                <div className="flex items-center gap-1">
                  <Icon name="Clock" size={14} className="text-muted-foreground" />
                  <span className="text-foreground text-sm">
                    {callData.duration_seconds ? `${Math.floor(callData.duration_seconds / 60)}:${String(callData.duration_seconds % 60).padStart(2, '0')}` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* AI Summary */}
          {callData.ai_summary && (
            <div className="bg-card border border-border rounded-lg p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="Sparkles" size={20} className="text-primary" />
                <h2 className="text-xl font-semibold text-foreground">AI Summary</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{callData.ai_summary}</p>
            </div>
          )}

          {/* Talk Ratio / Topics / QA */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-card border border-border rounded-lg p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-semibold text-foreground">Talk-to-Listen Ratio</h3>
                {talkSource && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    talkSource === 'transcript'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {talkSource === 'transcript' ? '📝 From transcript' : '🗄 From database'}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Based on word count per speaker
              </p>

              {/* Percentage summary */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: TALK_RATIO_COLORS.agent }} />
                  <span className="text-sm text-foreground font-semibold">{agentPct}%</span>
                  <span className="text-xs text-muted-foreground">Agent</span>
                  {wordCount.agent > 0 && (
                    <span className="text-xs text-muted-foreground">({wordCount.agent} words)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {wordCount.customer > 0 && (
                    <span className="text-xs text-muted-foreground">({wordCount.customer} words)</span>
                  )}
                  <span className="text-xs text-muted-foreground">Customer</span>
                  <span className="text-sm text-foreground font-semibold">{customerPct}%</span>
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: TALK_RATIO_COLORS.customer }} />
                </div>
              </div>

              {talkSource ? (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={talkData} layout="vertical" margin={{ left: 0, right: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis type="number" domain={[0, 100]} stroke="var(--color-muted-foreground)" tickFormatter={v => `${v}%`} />
                    <YAxis dataKey="speaker" type="category" stroke="var(--color-muted-foreground)" width={65} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                      formatter={(v, name, props) => [
                        `${v}%${props.payload.words ? ` (${props.payload.words} words)` : ''}`,
                        props.payload.speaker,
                      ]}
                    />
                    <Bar dataKey="percentage" radius={[0, 8, 8, 0]} label={{ position: 'right', formatter: v => `${v}%`, fill: 'var(--color-muted-foreground)', fontSize: 11 }}>
                      {talkData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center gap-2">
                  <Icon name="MessageSquareOff" size={28} className="text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">No transcript data to calculate ratio</p>
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">Smart Topics</h3>
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium">
                    <Icon name="Sparkles" size={11} />
                    Gemini AI
                  </span>
                </div>
                {/* Retry button */}
                {!topicsLoading && (
                  <button
                    onClick={() => {
                      const plainText = transcript.map(s => `${s.speaker}: ${s.message}`).join('\n').trim();
                      const text = plainText || (callData?.transcript_text ?? '');
                      if (!text) return;
                      setTopicsLoading(true);
                      setTopicsError(null);
                      extractTopics(text)
                        .then(r => setAiTopics(Array.isArray(r) ? r : []))
                        .catch(e => setTopicsError(e.message))
                        .finally(() => setTopicsLoading(false));
                    }}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                    title="Re-extract topics"
                  >
                    <Icon name="RefreshCw" size={14} />
                  </button>
                )}
              </div>

              {/* Loading */}
              {topicsLoading && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                    <div className="absolute inset-0 rounded-full border-t-2 border-violet-500 animate-spin" />
                    <Icon name="Sparkles" size={16} className="absolute inset-0 m-auto text-violet-400" />
                  </div>
                  <p className="text-xs text-muted-foreground animate-pulse">Gemini is analyzing the transcript…</p>
                </div>
              )}

              {/* Error */}
              {!topicsLoading && topicsError && (
                <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg mb-3">
                  <Icon name="AlertTriangle" size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-400">{topicsError}</p>
                </div>
              )}

              {/* Topics chips */}
              {!topicsLoading && aiTopics.length > 0 && (() => {
                const CATEGORY_STYLES = {
                  billing:    { bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  text: 'text-amber-400',  icon: 'DollarSign'   },
                  technical:  { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   text: 'text-blue-400',   icon: 'Wrench'       },
                  service:    { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: 'Headphones'  },
                  product:    { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', icon: 'Package'      },
                  account:    { bg: 'bg-sky-500/10',    border: 'border-sky-500/20',    text: 'text-sky-400',    icon: 'User'         },
                  logistics:  { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-400', icon: 'Truck'        },
                  default:    { bg: 'bg-primary/10',    border: 'border-primary/20',    text: 'text-primary',    icon: 'Tag'          },
                };
                return (
                  <div className="space-y-3">
                    {aiTopics.map((t, i) => {
                      const style = CATEGORY_STYLES[t.category] ?? CATEGORY_STYLES.default;
                      const rel   = Math.round((t.relevance_score ?? 0.5) * 100);
                      return (
                        <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${style.bg} ${style.border}`}>
                          <Icon name={style.icon} size={16} className={style.text} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-semibold ${style.text}`}>#{t.name}</span>
                              <span className="text-xs text-muted-foreground">{rel}%</span>
                            </div>
                            {/* Relevance bar */}
                            <div className="h-1 bg-border rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700`}
                                style={{ width: `${rel}%`, backgroundColor: `var(--color-${style.text.replace('text-', '').replace('-400','')}, #6366f1)` }}
                              />
                            </div>
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-md ${style.bg} ${style.text} capitalize font-medium`}>
                            {t.category}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Empty — no transcript yet */}
              {!topicsLoading && !topicsError && aiTopics.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <Icon name="MessageSquareOff" size={28} className="text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">No transcript available to extract topics</p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Icon name="Sparkles" size={11} className="text-violet-400" />
                  Topics extracted by Gemini AI from conversation transcript
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-foreground">Script Compliance</h3>
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 font-medium">
                    <Icon name="Sparkles" size={11} />
                    Gemini AI
                  </span>
                </div>
                {/* Retry */}
                {!qaLoading && (
                  <button
                    onClick={() => runComplianceCheck(transcript, callData?.transcript_text)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                    title="Re-run compliance check"
                  >
                    <Icon name="RefreshCw" size={14} />
                  </button>
                )}
              </div>

              {/* Score summary — only when results available */}
              {!qaLoading && qaAI.length > 0 && (() => {
                const passed = qaAI.filter(r => r.passed).length;
                const total  = qaAI.length;
                const pct    = Math.round((passed / total) * 100);
                const color  = pct === 100 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-rose-400';
                const barColor = pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
                return (
                  <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">Compliance Score</span>
                      <span className={`text-sm font-bold ${color}`}>{pct}% ({passed}/{total})</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })()}

              {/* Loading */}
              {qaLoading && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
                    <div className="absolute inset-0 rounded-full border-t-2 border-violet-500 animate-spin" />
                    <Icon name="ShieldCheck" size={16} className="absolute inset-0 m-auto text-violet-400" />
                  </div>
                  <p className="text-xs text-muted-foreground animate-pulse">Gemini is verifying script compliance…</p>
                </div>
              )}

              {/* Error */}
              {!qaLoading && qaError && (
                <div className="flex items-start gap-2 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg mb-3">
                  <Icon name="AlertTriangle" size={14} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-rose-400">{qaError}</p>
                </div>
              )}

              {/* Results */}
              {!qaLoading && qaAI.length > 0 && (
                <div className="space-y-3">
                  {QA_CRITERIA.map((criterion, i) => {
                    const result = qaAI.find(r => r.criteria_id === criterion.id) ?? qaAI[i];
                    const passed = result?.passed ?? false;
                    return (
                      <div key={criterion.id} className={`rounded-xl border p-4 transition-all ${
                        passed
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-rose-500/5 border-rose-500/20'
                      }`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                              passed ? 'bg-emerald-500/20' : 'bg-rose-500/20'
                            }`}>
                              <Icon
                                name={passed ? 'CheckCircle2' : 'XCircle'}
                                size={16}
                                className={passed ? 'text-emerald-500' : 'text-rose-500'}
                              />
                            </div>
                            <p className="text-sm font-semibold text-foreground">{criterion.title}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                            passed
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {passed ? '✅ Pass' : '❌ Fail'}
                          </span>
                        </div>
                        {/* AI explanation */}
                        {result?.details && (
                          <div className="ml-9 mt-1 px-3 py-2 bg-muted/40 rounded-lg">
                            <p className="text-xs text-muted-foreground italic leading-relaxed">💬 {result.details}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Empty state */}
              {!qaLoading && !qaError && qaAI.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <Icon name="MessageSquareOff" size={28} className="text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">No transcript available to check compliance</p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Icon name="Sparkles" size={11} className="text-violet-400" />
                  Verified by Gemini AI against QA script criteria
                </p>
              </div>
            </div>
          </div>

          {/* ── WhatsApp-style Conversation Script ──────────────────────────── */}
          <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">

            {/* Chat header bar */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                <Icon name="MessagesSquare" size={20} className="text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-foreground">Call Script</h2>
                <p className="text-xs text-muted-foreground">
                  {displayTranscript.length > 0
                    ? `${displayTranscript.length} messages`
                    : 'No transcript available'}
                  {agent?.name   && ` · Agent: ${agent.name}`}
                  {customer?.full_name && ` · Customer: ${customer.full_name}`}
                </p>
              </div>
              {displayTranscript.length > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                  Completed
                </span>
              )}
            </div>

            {/* Chat body */}
            {displayTranscript.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                  <Icon name="MessageSquareOff" size={26} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No transcript available</p>
                <p className="text-xs text-muted-foreground">Call segments will appear here after AI processing</p>
              </div>
            ) : (
              <div
                className="overflow-y-auto px-5 py-5 space-y-3 custom-scrollbar"
                style={{ maxHeight: '480px', background: 'var(--color-background)' }}
              >
                {displayTranscript.map((msg, i) => {
                  const isAgent    = msg.speaker === 'agent';
                  const sentColors = {
                    satisfied:  'bg-emerald-500',
                    neutral:    'bg-slate-400',
                    frustrated: 'bg-amber-500',
                    angry:      'bg-rose-500',
                  };
                  const dotColor = sentColors[msg.sentiment] ?? 'bg-slate-400';

                  return (
                    <div
                      key={i}
                      className={`flex items-end gap-2.5 ${
                        isAgent ? 'justify-start' : 'justify-end'
                      }`}
                    >
                      {/* Avatar — left for agent */}
                      {isAgent && (
                        <div className="w-8 h-8 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0 mb-1">
                          <Icon name="Headphones" size={15} className="text-blue-500" />
                        </div>
                      )}

                      {/* Bubble */}
                      <div
                        className={`relative max-w-[72%] ${
                          isAgent ? 'items-start' : 'items-end'
                        } flex flex-col`}
                      >
                        {/* Speaker label (first message or after opposite speaker) */}
                        {(i === 0 || displayTranscript[i - 1]?.speaker !== msg.speaker) && (
                          <span
                            className={`text-[10px] font-semibold mb-1 px-1 ${
                              isAgent ? 'text-blue-500' : 'text-violet-400'
                            }`}
                          >
                            {isAgent
                              ? (agent?.name ?? 'Agent')
                              : (customer?.full_name ?? customer?.company_name ?? 'Customer')}
                          </span>
                        )}

                        <div
                          className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                            isAgent
                              ? 'bg-blue-600/20 border border-blue-500/25 text-foreground rounded-tl-none'
                              : 'bg-violet-600/20 border border-violet-500/25 text-foreground rounded-tr-none'
                          }`}
                        >
                          {/* Chat bubble tail */}
                          <span
                            className={`absolute top-0 w-3 h-3 ${
                              isAgent ? '-left-1.5' : '-right-1.5'
                            }`}
                            style={{
                              borderTop: '6px solid transparent',
                              borderBottom: '6px solid transparent',
                              [isAgent ? 'borderRight' : 'borderLeft']: isAgent
                                ? '8px solid rgba(59,130,246,0.25)'
                                : '8px solid rgba(139,92,246,0.25)',
                            }}
                          />
                          <p>{msg.message}</p>
                        </div>

                        {/* Timestamp + sentiment dot */}
                        <div
                          className={`flex items-center gap-1.5 mt-1 px-1 ${
                            isAgent ? '' : 'flex-row-reverse'
                          }`}
                        >
                          {msg.timestamp && (
                            <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                          )}
                          <div
                            className={`w-2 h-2 rounded-full ${dotColor}`}
                            title={`Sentiment: ${msg.sentiment}`}
                          />
                          {!isAgent && (
                            <Icon name="CheckCheck" size={12} className="text-blue-400" />
                          )}
                        </div>
                      </div>

                      {/* Avatar — right for customer */}
                      {!isAgent && (
                        <div className="w-8 h-8 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0 mb-1">
                          <Icon name="User" size={15} className="text-violet-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend footer */}
            {displayTranscript.length > 0 && (
              <div className="flex items-center gap-5 px-5 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Satisfied
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  Frustrated
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500" />
                  Angry
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-slate-400" />
                  Neutral
                </div>
                <span className="ml-auto">● sentiment per message</span>
              </div>
            )}
          </div>

          {/* Problem & Solution */}
          <div className="mt-6">
            <SentimentAlertFeed
              transcript={displayTranscript}
              transcriptText={callData?.transcript_text ?? ''}
              loading={loading}
            />
          </div>

        </div>
      </main>
    </>
  );
};

export default CallDetails;