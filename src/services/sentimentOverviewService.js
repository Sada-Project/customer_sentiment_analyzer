import { supabase } from '../lib/supabase';

// ─── Helper ───────────────────────────────────────────────────────────────────
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Get start of today in ISO (local midnight → UTC) ─────────────────────────
function todayStartISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─── FILES PROCESSED TODAY ────────────────────────────────────────────────────
// Counts completed call_recordings with call_timestamp >= today
export async function fetchFilesProcessedToday() {
  const { count, error } = await supabase
    .from('call_recordings')
    .select('id', { count: 'exact', head: true })
    .gte('call_timestamp', todayStartISO())
    .eq('status', 'completed');

  if (error) throw new Error(`Files processed fetch failed: ${error.message}`);
  return count ?? 0;
}

// ─── TRANSCRIPTION CONFIDENCE ─────────────────────────────────────────────────
// Computes the average transcription_confidence from completed calls today.
// Falls back to all completed calls if today has none.
export async function fetchTranscriptionConfidence() {
  // Try today first
  const { data: todayData, error: todayErr } = await supabase
    .from('call_recordings')
    .select('transcription_confidence')
    .gte('call_timestamp', todayStartISO())
    .eq('status', 'completed')
    .not('transcription_confidence', 'is', null);

  if (todayErr) throw new Error(`Transcription confidence fetch failed: ${todayErr.message}`);

  let rows = todayData ?? [];

  // Fallback: if no calls today, use all completed calls
  if (rows.length === 0) {
    const { data: allData, error: allErr } = await supabase
      .from('call_recordings')
      .select('transcription_confidence')
      .eq('status', 'completed')
      .not('transcription_confidence', 'is', null)
      .limit(200);

    if (allErr) throw new Error(`Transcription confidence fallback failed: ${allErr.message}`);
    rows = allData ?? [];
  }

  if (rows.length === 0) return null;

  const avg = rows.reduce((sum, r) => sum + (r.transcription_confidence ?? 0), 0) / rows.length;
  return Number(avg.toFixed(1));
}
// ─── OVERALL SENTIMENT ───────────────────────────────────────────────────────
// Returns the dominant sentiment label + its percentage across all completed calls.
export async function fetchOverallSentiment() {
  const { data, error } = await supabase
    .from('call_recordings')
    .select('sentiment')
    .eq('status', 'completed')
    .not('sentiment', 'is', null);

  if (error) throw new Error(`Overall sentiment fetch failed: ${error.message}`);

  const rows = data ?? [];
  if (rows.length === 0) return null;

  // Count each sentiment
  const counts = { satisfied: 0, neutral: 0, frustrated: 0, angry: 0 };
  rows.forEach(r => { if (counts[r.sentiment] !== undefined) counts[r.sentiment]++; });

  // Find dominant
  const dominant = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
  const pct = ((dominant[1] / rows.length) * 100).toFixed(1);

  return {
    label:      dominant[0].charAt(0).toUpperCase() + dominant[0].slice(1),
    percentage: Number(pct),
    total:      rows.length,
    counts,
  };
}

// Groups completed call_recordings by 3-hour time buckets for the last N hours.
// Falls back to sentiment_timeline table if no call_recordings data exists.
export async function fetchSentimentTimeline(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // Primary: compute from actual call_recordings
  const { data: callData, error: callErr } = await supabase
    .from('call_recordings')
    .select('call_timestamp, sentiment')
    .gte('call_timestamp', since)
    .eq('status', 'completed')
    .not('sentiment', 'is', null)
    .order('call_timestamp', { ascending: true });

  if (!callErr && callData && callData.length > 0) {
    // Group into 3-hour buckets
    const buckets = {};
    callData.forEach(row => {
      const ts   = new Date(row.call_timestamp);
      const hour = Math.floor(ts.getHours() / 3) * 3;
      const key  = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate(), hour).toISOString();
      if (!buckets[key]) {
        buckets[key] = { satisfied: 0, neutral: 0, frustrated: 0, angry: 0, interactions: 0 };
      }
      const b = buckets[key];
      if (row.sentiment === 'satisfied')  b.satisfied++;
      if (row.sentiment === 'neutral')    b.neutral++;
      if (row.sentiment === 'frustrated') b.frustrated++;
      if (row.sentiment === 'angry')      b.angry++;
      b.interactions++;
    });

    const sorted = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([key, counts]) => ({
      time: new Date(key).toLocaleString('en-US', {
        month:  hours > 24 ? 'short'   : undefined,
        day:    hours > 24 ? 'numeric' : undefined,
        hour:   '2-digit',
        minute: hours > 24 ? undefined : '2-digit',
        hour12: false,
      }),
      ...counts,
    }));
  }

  // Fallback: read from sentiment_timeline table (seeded aggregate data)
  const { data, error } = await supabase
    .from('sentiment_timeline')
    .select('*')
    .gte('time_bucket', since)
    .order('time_bucket', { ascending: true });

  if (error) throw new Error(`Timeline fetch failed: ${error.message}`);

  return (data ?? []).map(row => ({
    time: new Date(row.time_bucket).toLocaleString('en-US', {
      month:  hours > 24 ? 'short'   : undefined,
      day:    hours > 24 ? 'numeric' : undefined,
      hour:   '2-digit',
      minute: hours > 24 ? undefined : '2-digit',
      hour12: false,
    }),
    satisfied:    row.satisfied_count    ?? 0,
    neutral:      row.neutral_count      ?? 0,
    frustrated:   row.frustrated_count   ?? 0,
    angry:        row.angry_count        ?? 0,
    interactions: row.total_interactions ?? 0,
  }));
}

// ─── EMOTION DISTRIBUTION ─────────────────────────────────────────────────────
// Computes distribution from actual call_recordings.
// Falls back to sentiment_distribution table if no records exist.
export async function fetchSentimentDistribution() {
  // Primary: compute from actual call_recordings (all completed)
  const { data: callData, error: callErr } = await supabase
    .from('call_recordings')
    .select('sentiment')
    .eq('status', 'completed')
    .not('sentiment', 'is', null);

  if (!callErr && callData && callData.length > 0) {
    const counts = { satisfied: 0, neutral: 0, frustrated: 0, angry: 0 };
    callData.forEach(r => { if (counts[r.sentiment] !== undefined) counts[r.sentiment]++; });
    const total = callData.length;
    const order = ['satisfied', 'neutral', 'frustrated', 'angry'];
    return order.map(name => ({
      name,
      value:      counts[name],
      percentage: ((counts[name] / total) * 100).toFixed(1),
    }));
  }

  // Fallback: read from sentiment_distribution table
  const today = new Date().toISOString().split('T')[0];
  let { data, error } = await supabase
    .from('sentiment_distribution')
    .select('*')
    .eq('period_date', today);

  if (error) throw new Error(`Distribution fetch failed: ${error.message}`);

  // If today has no data, grab the most recent date
  if (!data || data.length === 0) {
    const fallback = await supabase
      .from('sentiment_distribution')
      .select('*')
      .order('period_date', { ascending: false })
      .limit(4);

    if (fallback.error) throw new Error(`Distribution fallback failed: ${fallback.error.message}`);
    data = fallback.data ?? [];
  }

  return (data ?? []).map(row => ({
    name:       row.sentiment,
    value:      row.call_count,
    percentage: Number(row.percentage).toFixed(1),
  }));
}

// ─── LIVE ACTIVITY FEED (kept for potential future use) ───────────────────────
export async function fetchLiveActivity(limit = 10) {
  let { data, error } = await supabase
    .from('vw_live_activity_feed')
    .select('*')
    .limit(limit);

  if (error) {
    console.warn('[sentimentOverview] View unavailable, falling back:', error.message);
    const fallback = await supabase
      .from('call_recordings')
      .select('id, call_ref, sentiment, sentiment_confidence, call_timestamp, duration_seconds, status, interaction_type, transcript_text')
      .in('status', ['completed', 'processing'])
      .order('call_timestamp', { ascending: false })
      .limit(limit);

    if (fallback.error) throw new Error(`Activity feed failed: ${fallback.error.message}`);
    return (fallback.data ?? []).map(row => ({
      id:              row.id,
      callRef:         row.call_ref,
      customer:        'Customer',
      customerId:      '—',
      sentiment:       row.sentiment,
      confidence:      row.sentiment_confidence != null ? Number(row.sentiment_confidence).toFixed(0) : null,
      timestamp:       row.call_timestamp,
      duration:        formatDuration(row.duration_seconds),
      status:          row.status,
      transcript:      row.transcript_text ?? null,
      agentName:       null,
      interactionType: row.interaction_type,
    }));
  }

  return (data ?? []).map(row => ({
    id:              row.id,
    callRef:         row.call_ref,
    customer:        row.customer        ?? 'Unknown Customer',
    customerId:      row.customer_id     ?? '—',
    sentiment:       row.sentiment,
    confidence:      row.confidence != null ? Number(row.confidence).toFixed(0) : null,
    timestamp:       row.timestamp,
    duration:        formatDuration(row.duration_seconds),
    status:          row.status,
    transcript:      row.first_message   ?? row.transcript_text ?? null,
    agentName:       row.agent_name,
    interactionType: row.interaction_type,
  }));
}
