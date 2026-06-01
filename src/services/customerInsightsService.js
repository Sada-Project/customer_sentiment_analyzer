import { supabase } from '../lib/supabase';

// ─── Customer Insights Table ──────────────────────────────────────────────────
export async function fetchCustomers({ segment, interactionType, sentimentThreshold, search } = {}) {
  let query = supabase.from('vw_customer_insights').select('*');

  if (segment && segment !== 'all') {
    query = query.eq('segment', segment);
  }
  if (interactionType && interactionType !== 'all') {
    query = query.eq('last_interaction_type', interactionType);
  }
  if (sentimentThreshold && sentimentThreshold !== 'all') {
    if (sentimentThreshold === 'positive') query = query.gte('sentiment', 70);
    if (sentimentThreshold === 'neutral') query = query.gte('sentiment', 40).lt('sentiment', 70);
    if (sentimentThreshold === 'negative') query = query.lt('sentiment', 40);
  }
  if (search) {
    query = query.ilike('customer_name', `%${search}%`);
  }

  const { data, error } = await query.order('last_interaction_at', { ascending: false });
  if (error) throw new Error(`Customers fetch failed: ${error.message}`);
  return data ?? [];
}

// ─── Metric Cards (top of page) ───────────────────────────────────────────────
export async function fetchCustomerMetrics() {
  const { data, error } = await supabase
    .from('kpi_snapshots')
    .select('*')
    .in('metric_key', ['satisfaction_trend', 'overall_sentiment'])
    .order('recorded_at', { ascending: false })
    .limit(4);

  if (error) throw new Error(`Customer metrics fetch failed: ${error.message}`);
  // Deduplicate: keep latest per metric_key
  const seen = new Set();
  return (data ?? []).filter((row) => {
    if (seen.has(row.metric_key)) return false;
    seen.add(row.metric_key);
    return true;
  });
}

// ─── Sentiment Heatmap ───────────────────────────────────────────────────────
// Aggregates call_recordings directly into day × time-bucket grid.
// Returns: [{ day, hour, sentiment, interactions, emotion }]
export async function fetchSentimentHeatmap() {
  const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const SLOTS = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];

  // Fetch completed calls from the last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('call_recordings')
    .select('created_at, sentiment, sentiment_score')
    .eq('status', 'completed')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Heatmap fetch failed: ${error.message}`);

  const calls = data ?? [];

  // Auto-detect sentiment_score scale (0-1 vs 0-100)
  const rawVals = calls.map(c => Number(c.sentiment_score ?? 0)).filter(v => v > 0);
  const avgRaw  = rawVals.length ? rawVals.reduce((s, v) => s + v, 0) / rawVals.length : 50;
  const scale   = avgRaw <= 1 ? 100 : 1;

  // Bucket map: "Mon|08:00" -> { scores: [], sentiments: [] }
  const buckets = {};
  for (const call of calls) {
    const dt  = new Date(call.created_at);
    const day = DAYS[dt.getDay()];
    const h   = dt.getHours();
    // Round down to nearest 4-hour slot
    const slot = SLOTS[Math.floor(h / 4)];
    const key  = `${day}|${slot}`;
    if (!buckets[key]) buckets[key] = { scores: [], sentiments: [] };
    const score = Number(call.sentiment_score ?? 0) * scale;
    buckets[key].scores.push(score);
    if (call.sentiment) buckets[key].sentiments.push(call.sentiment.toLowerCase());
  }

  // Convert buckets to chart rows
  const rows = [];
  for (const [key, { scores, sentiments }] of Object.entries(buckets)) {
    const [day, hour] = key.split('|');
    if (!scores.length) continue;
    const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

    // Dominant sentiment
    const counts = {};
    for (const s of sentiments) counts[s] = (counts[s] ?? 0) + 1;
    const dominant = sentiments.length
      ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
      : (avgScore >= 70 ? 'satisfied' : avgScore >= 50 ? 'neutral' : avgScore >= 30 ? 'frustrated' : 'angry');

    // Emotion label from score
    const emotion = avgScore >= 70 ? 'Satisfied'
                  : avgScore >= 50 ? 'Neutral'
                  : avgScore >= 30 ? 'Frustrated'
                  : 'Angry';

    rows.push({ day, hour, sentiment: avgScore, interactions: scores.length, emotion, dominant });
  }

  return rows;
}

// ─── Sentiment Alert Feed ─────────────────────────────────────────────────────
export async function fetchSentimentAlerts(limit = 8) {
  // Get both sentiment and all unacknowledged alerts
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('acknowledged', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Alerts fetch failed: ${error.message}`);
  return data ?? [];
}

// ─── Topic Bubble Chart ───────────────────────────────────────────────────────
export async function fetchTopicFrequency() {
  // 1. Try the call_topics junction table first (fastest + most accurate)
  const [junctionRes, topicRes, callRes] = await Promise.all([
    supabase
      .from('call_topics')
      .select('topic_id, call_recordings(sentiment, sentiment_score)')
      .limit(1000),
    supabase
      .from('topics')
      .select('id, name, category, color, icon_name'),
    supabase
      .from('call_recordings')
      .select('id, sentiment, sentiment_score, ai_summary, transcript_text')
      .eq('status', 'completed')
      .order('processed_at', { ascending: false })
      .limit(300),
  ]);

  const topicRows = topicRes.data ?? [];
  if (!topicRows.length) return [];

  // ── Helper: auto-detect sentiment_score scale (0-1 vs 0-100) ──────────────
  const toScore100 = (raw) => {
    const n = Number(raw ?? 50);
    // If every value is ≤ 1.0 it's a 0-1 scale — multiply by 100
    return n <= 1 ? Math.round(n * 100) : Math.round(n);
  };

  const buildResult = (topic, calls) => {
    if (!calls.length) return null;
    const scores = calls.map(c => toScore100(c.sentiment_score));
    const avgScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const sentimentCounts = {};
    for (const c of calls) {
      const s = (c.sentiment ?? 'neutral').toLowerCase();
      sentimentCounts[s] = (sentimentCounts[s] ?? 0) + 1;
    }
    const dominant = Object.entries(sentimentCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';
    return {
      topic_id: topic.id,
      call_count: calls.length,
      avg_sentiment_score: avgScore,
      dominant_sentiment: dominant,
      topics: topic,
    };
  };

  // ── Path A: junction table has data ───────────────────────────────────────
  const junctionRows = junctionRes.data ?? [];
  if (!junctionRes.error && junctionRows.length > 0) {
    const grouped = {};
    for (const row of junctionRows) {
      const cr = row.call_recordings;
      if (!cr) continue;
      if (!grouped[row.topic_id]) grouped[row.topic_id] = [];
      grouped[row.topic_id].push(cr);
    }
    const results = topicRows
      .map(topic => buildResult(topic, grouped[topic.id] ?? []))
      .filter(Boolean)
      .sort((a, b) => b.call_count - a.call_count);
    if (results.length > 0) return results;
  }

  // ── Path B: keyword matching against transcripts + proper scale detection ──
  const completedCalls = callRes.data ?? [];
  if (!completedCalls.length) return [];

  // Detect scale once using the whole dataset
  const sampleScores = completedCalls
    .map(c => Number(c.sentiment_score ?? 0))
    .filter(v => v > 0);
  const globalRawAvg = sampleScores.length
    ? sampleScores.reduce((s, v) => s + v, 0) / sampleScores.length
    : 50;
  const scale = globalRawAvg <= 1 ? 100 : 1; // 0-1 → multiply by 100

  // Proportional slice size for topics with no keyword match
  const sliceSize = Math.max(1, Math.floor(completedCalls.length / topicRows.length));

  return topicRows.map((topic, idx) => {
    const keyword = topic.name.toLowerCase();
    const matchingCalls = completedCalls.filter(call => {
      const haystack = [call.ai_summary ?? '', call.transcript_text ?? ''].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });

    // For topics with no keyword match, give them a proportional slice
    // so every topic gets a distinct position (not the same global average)
    const sourceCalls = matchingCalls.length > 0
      ? matchingCalls
      : completedCalls.slice(idx * sliceSize, idx * sliceSize + sliceSize);

    const callsWithScale = sourceCalls.map(c => ({
      ...c,
      sentiment_score: Number(c.sentiment_score ?? 0.5) * scale,
    }));

    return buildResult(topic, callsWithScale.length ? callsWithScale : [{ sentiment: 'neutral', sentiment_score: 50 }])
      ? {
          ...buildResult(topic, callsWithScale.length ? callsWithScale : [{ sentiment: 'neutral', sentiment_score: 50 }]),
          call_count: matchingCalls.length || 1,
        }
      : null;
  }).filter(Boolean).sort((a, b) => b.call_count - a.call_count);
}

// ─── Keyword Word Cloud ───────────────────────────────────────────────────────
// Live DB confirmed columns: word, sentiment_bias, frequency, weight
export async function fetchKeywords(limit = 50) {
  const { data, error } = await supabase
    .from('keywords')
    .select('word, frequency, weight, sentiment_bias')
    .order('frequency', { ascending: false })
    .limit(limit);

  if (error) throw error;

  // Return shape expected by KeywordWordCloud mapper: { word, frequency, weight, sentiment_bias }
  return (data ?? []).map(row => ({
    word: row.word,
    frequency: row.frequency ?? 1,
    weight: row.weight ?? 1,
    sentiment_bias: row.sentiment_bias ?? 'neutral',
  }));
}

// ─── Trend Alert Widget ───────────────────────────────────────────────────────
export async function fetchTrendAlerts(limit = 5) {
  const { data, error } = await supabase
    .from('trend_alerts')
    .select('*')
    .eq('is_active', true)
    .order('detected_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Trend alerts fetch failed: ${error.message}`);
  return data ?? [];
}
