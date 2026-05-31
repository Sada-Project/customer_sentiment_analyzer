import { supabase } from '../lib/supabase';

// ─── Helper ───────────────────────────────────────────────────────────────────
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── KPI Cards ────────────────────────────────────────────────────────────────
export async function fetchKPIs(timePeriod = '24h') {
  const { data, error } = await supabase
    .from('kpi_snapshots')
    .select('*')
    .eq('time_period', timePeriod)
    .order('recorded_at', { ascending: false });

  if (error) throw error;

  // Deduplicate: keep the latest snapshot per metric_key
  const seen = new Set();
  const unique = (data ?? []).filter((row) => {
    if (seen.has(row.metric_key)) return false;
    seen.add(row.metric_key);
    return true;
  });

  return unique;
}

// ─── Sentiment Timeline Chart ─────────────────────────────────────────────────
export async function fetchSentimentTimeline(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('sentiment_timeline')
    .select('*')
    .gte('time_bucket', since)
    .order('time_bucket', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    time: new Date(row.time_bucket).toLocaleString('en-US', {
      month: hours > 24 ? 'short' : undefined,
      day:   hours > 24 ? 'numeric' : undefined,
      hour:  '2-digit',
      minute: hours > 24 ? undefined : '2-digit',
      hour12: false,
    }),
    satisfied:    row.satisfied_count,
    neutral:      row.neutral_count,
    frustrated:   row.frustrated_count,
    angry:        row.angry_count,
    interactions: row.total_interactions,
  }));
}

// ─── Live Activity Feed ───────────────────────────────────────────────────────
export async function fetchLiveActivity(limit = 10) {
  const { data, error } = await supabase
    .from('vw_live_activity_feed')
    .select('*')
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id:         row.id,
    callRef:    row.call_ref,
    customer:   row.customer   ?? 'Unknown Customer',
    customerId: row.customer_id ?? '—',
    sentiment:  row.sentiment,
    confidence: row.confidence != null ? Number(row.confidence).toFixed(0) : null,
    timestamp:  row.timestamp,
    duration:   formatDuration(row.duration_seconds),
    status:     row.status,
    // the view exposes first_message from call_transcript_segments
    transcript: row.first_message ?? row.transcript_text ?? null,
    agentName:  row.agent_name,
    interactionType: row.interaction_type,
  }));
}

// ─── Sentiment Distribution ───────────────────────────────────────────────────
export async function fetchSentimentDistribution(date) {
  // Try today first; fall back to the most recent date in the table
  const targetDate = date ?? new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('sentiment_distribution')
    .select('*')
    .eq('period_date', targetDate);

  if (error) throw error;

  // If today has no data yet, grab the latest available date
  if (!data || data.length === 0) {
    const { data: latest, error: latestErr } = await supabase
      .from('sentiment_distribution')
      .select('*')
      .order('period_date', { ascending: false })
      .limit(4);

    if (latestErr) throw latestErr;

    return (latest ?? []).map((row) => ({
      name:       row.sentiment,
      value:      row.call_count,
      percentage: Number(row.percentage).toFixed(1),
    }));
  }

  return data.map((row) => ({
    name:       row.sentiment,
    value:      row.call_count,
    percentage: Number(row.percentage).toFixed(1),
  }));
}

// ─── Quick Stats (new) ────────────────────────────────────────────────────────
// Returns: { totalCallsToday, activeAgents, avgSentimentToday, pendingQueue }
export async function fetchQuickStats() {
  const today = new Date().toISOString().split('T')[0];

  const [callsRes, agentsRes, queueRes] = await Promise.all([
    supabase
      .from('call_recordings')
      .select('id, sentiment_score', { count: 'exact', head: false })
      .gte('call_timestamp', today + 'T00:00:00Z')
      .eq('status', 'completed'),
    supabase
      .from('agents')
      .select('id', { count: 'exact', head: true })
      .eq('is_online', true),
    supabase
      .from('call_recordings')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'processing']),
  ]);

  const calls   = callsRes.data ?? [];
  const avgScore = calls.length > 0
    ? (calls.reduce((sum, c) => sum + (c.sentiment_score ?? 0), 0) / calls.length).toFixed(1)
    : null;

  return {
    totalCallsToday: callsRes.count ?? calls.length,
    activeAgents:    agentsRes.count ?? 0,
    avgSentimentToday: avgScore,
    pendingQueue:    queueRes.count ?? 0,
  };
}
