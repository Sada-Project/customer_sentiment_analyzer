import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import GeminiAnalysisPanel from '../../components/GeminiAnalysisPanel';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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

  const [callData,    setCallData]    = useState(null);
  const [transcript,  setTranscript]  = useState([]);
  const [topics,      setTopics]      = useState([]);
  const [qaResults,   setQaResults]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

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
        const [trans, tops, qa] = await Promise.all([
          fetchTranscript(call.id),
          fetchCallTopics(call.id),
          fetchCallQA(call.id),
        ]);
        if (cancelled) return;
        setTranscript(trans);
        setTopics(tops);
        setQaResults(qa);
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [callId]);

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
  const talkData = [
    { speaker: 'Agent',    percentage: Math.round(callData.agent_talk_pct ?? 40),    color: TALK_RATIO_COLORS.agent    },
    { speaker: 'Customer', percentage: Math.round(callData.customer_talk_pct ?? 60), color: TALK_RATIO_COLORS.customer },
  ];

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
              <div className="flex gap-3">
                <Button variant="outline" iconName="Download" iconPosition="left">Export</Button>
                <Button variant="outline" iconName="Share2"   iconPosition="left">Share</Button>
              </div>
            </div>
          </div>

          {/* Call Overview */}
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Customer</p>
                <p className="text-base font-semibold text-foreground">{customer?.full_name ?? customer?.company_name ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{customer?.customer_ref ?? '—'}</p>
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
              <h3 className="text-lg font-semibold text-foreground mb-4">Talk-to-Listen Ratio</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={talkData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" domain={[0, 100]} stroke="var(--color-muted-foreground)" />
                  <YAxis dataKey="speaker" type="category" stroke="var(--color-muted-foreground)" />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px' }} formatter={v => `${v}%`} />
                  <Bar dataKey="percentage" radius={[0, 8, 8, 0]}>
                    {talkData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Smart Topics</h3>
              <div className="flex flex-wrap gap-3">
                {displayTopics.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
                    <Icon name={t.icon} size={16} className="text-primary" />
                    <span className="text-sm font-medium text-primary">{t.tag}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-xs text-muted-foreground">Topics detected using AI-powered intent recognition</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Script Compliance</h3>
              <div className="space-y-4">
                {displayQA.map((check, i) => (
                  <div key={i} className="border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-foreground">{check.item}</p>
                      {check.status === 'pass' ? (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded-full">
                          <Icon name="CheckCircle2" size={14} className="text-emerald-600" />
                          <span className="text-xs font-medium text-emerald-600">Pass ✅</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-rose-500/10 rounded-full">
                          <Icon name="XCircle" size={14} className="text-rose-600" />
                          <span className="text-xs font-medium text-rose-600">Fail ❌</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{check.description}</p>
                    {check.details && (
                      <div className="bg-muted/30 rounded p-2">
                        <p className="text-xs text-muted-foreground italic">{check.details}</p>
                      </div>
                    )}
                  </div>
                ))}
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

          {/* Gemini AI Analysis Panel */}
          <div className="mt-6">
            <GeminiAnalysisPanel
              transcript={displayTranscript.map(m => `${m.speaker === 'agent' ? 'Agent' : 'Customer'}: ${m.message}`).join('\n')}
              callMeta={{
                customerName:    customer?.full_name ?? customer?.company_name,
                agentName:       agent?.name,
                interactionType: callData?.interaction_type,
                duration:        callData?.duration_seconds
                  ? `${Math.floor(callData.duration_seconds / 60)}:${String(callData.duration_seconds % 60).padStart(2, '0')}`
                  : undefined,
              }}
            />
          </div>

        </div>
      </main>
    </>
  );
};

export default CallDetails;