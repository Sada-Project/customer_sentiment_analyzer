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
export async function fetchTopicFrequency(hoursBack = null) {
  // Optional time window filter
  const since = hoursBack
    ? new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()
    : null;

  // 1. Try the call_topics junction table first (fastest + most accurate)
  let callQuery = supabase
    .from('call_recordings')
    .select('id, sentiment, sentiment_score, ai_summary, transcript_text')
    .eq('status', 'completed')
    .order('processed_at', { ascending: false })
    .limit(300);
  if (since) callQuery = callQuery.gte('created_at', since);

  let junctionQuery = supabase
    .from('call_topics')
    .select('topic_id, call_recordings(sentiment, sentiment_score, created_at)')
    .limit(1000);

  const [junctionRes, topicRes, callRes] = await Promise.all([
    junctionQuery,
    supabase.from('topics').select('id, name, category, color, icon_name'),
    callQuery,
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

  // Only include topics that have REAL keyword matches in transcripts/summaries.
  // Skip the old "proportional slice" fallback — it was creating dozens of
  // ghost neutral bubbles for every unmatched topic.
  const matched = topicRows
    .map(topic => {
      const keyword = topic.name.toLowerCase();
      const matchingCalls = completedCalls.filter(call => {
        const haystack = [call.ai_summary ?? '', call.transcript_text ?? ''].join(' ').toLowerCase();
        return haystack.includes(keyword);
      });

      if (!matchingCalls.length) return null; // skip — no real data

      const callsWithScale = matchingCalls.map(c => ({
        ...c,
        sentiment_score: Number(c.sentiment_score ?? 0.5) * scale,
      }));

      const result = buildResult(topic, callsWithScale);
      return result ? { ...result, call_count: matchingCalls.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.call_count - a.call_count);

  // Cap at top 12 so the chart stays readable
  return matched.slice(0, 12);
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

// ─── Rising Topics — Voice Analysis Pipeline ──────────────────────────────────
// Counts how many times each topic was mentioned in recent hours.
// Uses sliding windows: last 1 h → 6 h → 24 h → all time (fallback).
// Severity score 0-100 combines frequency rank + negative-sentiment ratio.
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchRisingTopics(limit = 5) {
  const NEGATIVE_SENTIMENTS = new Set(['frustrated', 'angry']);
  const CATEGORY_ICONS = {
    billing:   'DollarSign', technical: 'Wrench', service: 'Headphones',
    product:   'Package',    account:  'User',    logistics: 'Truck',
  };

  const now = Date.now();
  const since = {
    '1h':  new Date(now - 1  * 60 * 60 * 1000).toISOString(),
    '6h':  new Date(now - 6  * 60 * 60 * 1000).toISOString(),
    '24h': new Date(now - 24 * 60 * 60 * 1000).toISOString(),
  };

  // ── 1. Topics master list ────────────────────────────────────────────────
  const { data: topicRows, error: topicErr } = await supabase
    .from('topics')
    .select('id, name, category, icon_name')
    .limit(50);
  if (topicErr) throw new Error(`Rising topics: ${topicErr.message}`);
  if (!topicRows?.length) return [];

  // ── 2. Fetch recent call_recordings (last 24 h, completed) ──────────────
  const { data: callRows } = await supabase
    .from('call_recordings')
    .select('id, sentiment, sentiment_score, ai_summary, transcript_text, processed_at, created_at')
    .eq('status', 'completed')
    .gte('created_at', since['24h'])
    .order('created_at', { ascending: false })
    .limit(1000);

  // ── 3. Always fetch all-time calls (needed for junction-table lookup) ────
  // Junction table (call_topics) may reference call_ids older than 24 h;
  // without an all-time pool those IDs would silently disappear from callMap.
  const { data: allCallRows } = await supabase
    .from('call_recordings')
    .select('id, sentiment, sentiment_score, ai_summary, transcript_text, processed_at, created_at')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(500);

  const recentCalls  = callRows  ?? [];
  const historicPool = allCallRows ?? [];

  // allCalls = union, deduplicated by id (recent first)
  const allCallsMap = {};
  for (const c of [...historicPool, ...recentCalls]) allCallsMap[c.id] = c;
  const allCalls = Object.values(allCallsMap);

  const usingAllTime = recentCalls.length === 0;

  if (!allCalls.length) return [];

  // ── 4. Try call_topics junction first ───────────────────────────────────
  const { data: junctionRows } = await supabase
    .from('call_topics')
    .select('topic_id, call_id')
    .limit(5000);

  // Build call_id → call map for quick lookup (covers all-time pool)
  const callMap = allCallsMap;

  // Group by topic via junction if data exists
  const jGrouped = {};
  for (const row of junctionRows ?? []) {
    const call = callMap[row.call_id];
    if (!call) continue;
    if (!jGrouped[row.topic_id]) jGrouped[row.topic_id] = [];
    jGrouped[row.topic_id].push(call);
  }
  const useJunction = Object.keys(jGrouped).length > 0;

  // ── 5. Build stats per topic with time-window breakdown ─────────────────
  const stats = topicRows.map(topic => {
    let matchedCalls;

    if (useJunction) {
      matchedCalls = jGrouped[topic.id] ?? [];
    } else {
      // Keyword match against ai_summary + transcript_text
      const kw = topic.name.toLowerCase();
      matchedCalls = allCalls.filter(c => {
        const hay = [c.ai_summary ?? '', c.transcript_text ?? ''].join(' ').toLowerCase();
        return hay.includes(kw);
      });
    }

    if (!matchedCalls.length) return null;

    // Count per time window
    const countIn = (windowKey) => {
      if (usingAllTime) return matchedCalls.length; // no timestamp window
      const cutoff = since[windowKey];
      return matchedCalls.filter(c => (c.created_at ?? c.processed_at ?? '') >= cutoff).length;
    };

    const count1h  = countIn('1h');
    const count6h  = countIn('6h');
    const count24h = countIn('24h');

    // Pick the tightest window that has data
    let recentCount, timeframe;
    if (count1h > 0)       { recentCount = count1h;  timeframe = 'last hour';    }
    else if (count6h > 0)  { recentCount = count6h;  timeframe = 'last 6 hours'; }
    else if (count24h > 0) { recentCount = count24h; timeframe = 'last 24 hours';}
    else                   { recentCount = matchedCalls.length; timeframe = 'all time'; }

    const urgency = matchedCalls.length > 0
      ? matchedCalls.filter(c => NEGATIVE_SENTIMENTS.has((c.sentiment ?? '').toLowerCase())).length / matchedCalls.length
      : 0;

    return { topic, count: matchedCalls.length, recentCount, timeframe, urgency };
  }).filter(Boolean);

  // If no topic has activity in any recent window, keep them all (all-time fallback)
  const activeStats = stats.filter(s => s.recentCount > 0);
  const finalStats  = activeStats.length > 0 ? activeStats : stats;

  if (!finalStats.length) return [];

  // ── 6. Score & map severity ─────────────────────────────────────────────
  const maxCount = Math.max(...finalStats.map(s => s.recentCount));

  const scored = finalStats.map(s => {
    const freqScore     = maxCount > 0 ? (s.recentCount / maxCount) * 100 : 0;
    const urgScore      = s.urgency * 100;
    const rawScore      = freqScore * 0.5 + urgScore * 0.5;
    const severityScore = Math.min(100, Math.max(0, Math.round(rawScore)));

    let severity, bgColor, borderColor, textColor, badgeBg;
    if (severityScore >= 80) {
      severity = 'CRITICAL'; bgColor = 'bg-rose-500/10';   borderColor = 'border-rose-500/30';
      textColor = 'text-rose-400';  badgeBg = 'bg-rose-500/20';
    } else if (severityScore >= 60) {
      severity = 'HIGH';     bgColor = 'bg-orange-500/10'; borderColor = 'border-orange-500/30';
      textColor = 'text-orange-400'; badgeBg = 'bg-orange-500/20';
    } else if (severityScore >= 40) {
      severity = 'MEDIUM';   bgColor = 'bg-amber-500/10';  borderColor = 'border-amber-500/30';
      textColor = 'text-amber-400'; badgeBg = 'bg-amber-500/20';
    } else {
      severity = 'LOW';      bgColor = 'bg-blue-500/10';   borderColor = 'border-blue-500/30';
      textColor = 'text-blue-400';  badgeBg = 'bg-blue-500/20';
    }

    const icon = s.topic.icon_name || CATEGORY_ICONS[s.topic.category] || 'Tag';

    return {
      id: s.topic.id, topic: s.topic.name, category: s.topic.category, icon,
      severityScore, severity,
      count: s.recentCount,     // mentions in the tightest recent window
      timeframe: s.timeframe,   // e.g. "last hour", "last 6 hours"
      urgencyPct: Math.round(s.urgency * 100),
      bgColor, borderColor, textColor, badgeBg,
    };
  });

  return scored
    .sort((a, b) => b.severityScore - a.severityScore)
    .slice(0, limit);
}

