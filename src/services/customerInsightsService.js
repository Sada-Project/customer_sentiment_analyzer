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
    if (sentimentThreshold === 'neutral')  query = query.gte('sentiment', 40).lt('sentiment', 70);
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

// ─── Sentiment Heatmap ────────────────────────────────────────────────────────
export async function fetchSentimentHeatmap() {
  // Always use the current week's Monday as the anchor date
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const daysToMonday = (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);
  const weekStart = monday.toISOString().split('T')[0];

  let { data, error } = await supabase
    .from('sentiment_heatmap')
    .select('*')
    .eq('period_week_start', weekStart);

  if (error) throw new Error(`Heatmap fetch failed: ${error.message}`);

  // Fallback: if this week has no data yet, grab the most recent week
  if (!data || data.length === 0) {
    const fallback = await supabase
      .from('sentiment_heatmap')
      .select('*')
      .order('period_week_start', { ascending: false })
      .limit(42); // max 7 days × 6 buckets

    if (fallback.error) throw new Error(`Heatmap fallback failed: ${fallback.error.message}`);
    return fallback.data ?? [];
  }

  return data;
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
// Strategy: read from call_recordings with their sentiment, then count per topic
// using call_topics junction if available. Fallback: return topics list with
// frequency derived from call_recordings sentiment aggregate.
//
// Live DB confirmed tables:
//   topics: id, name, category, color, icon_name, description
//   call_recordings: id, sentiment, sentiment_score, status
//
export async function fetchTopicFrequency() {
  // Step 1: Get all completed call_recordings with sentiment
  const { data: calls, error: callErr } = await supabase
    .from('call_recordings')
    .select('id, sentiment, sentiment_score, ai_summary, transcript_text')
    .eq('status', 'completed')
    .order('processed_at', { ascending: false })
    .limit(200);

  if (callErr) throw callErr;

  // Step 2: Get all topics (the master table, not junction)
  const { data: topicRows, error: topicErr } = await supabase
    .from('topics')
    .select('id, name, category, color, icon_name')
    .order('name');

  if (topicErr) throw topicErr;
  if (!topicRows?.length) return [];

  const completedCalls = calls ?? [];
  const totalCalls = completedCalls.length;

  if (totalCalls === 0) return [];

  // Step 3: For each topic, count how many call summaries/transcripts mention it
  // and derive a sentiment score from those matching calls.
  // This gives us a real frequency + sentiment per topic even without call_topics.
  return topicRows.map((topic) => {
    const keyword = topic.name.toLowerCase();

    // Find calls whose ai_summary or transcript mentions this topic name
    const matchingCalls = completedCalls.filter(call => {
      const haystack = [
        call.ai_summary ?? '',
        call.transcript_text ?? '',
      ].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });

    const count = matchingCalls.length;
    if (count === 0) {
      // Still include the topic but with minimal count so it appears in the chart
      const globalAvg = completedCalls.length > 0
        ? Math.round(completedCalls.reduce((s, c) => s + Number(c.sentiment_score ?? 50), 0) / completedCalls.length)
        : 50;
      return {
        topic_id:            topic.id,
        call_count:          1, // show even if no explicit match
        avg_sentiment_score: globalAvg,
        dominant_sentiment:  completedCalls[0]?.sentiment ?? 'neutral',
        topics:              topic,
      };
    }

    const avgScore = Math.round(
      matchingCalls.reduce((s, c) => s + Number(c.sentiment_score ?? 50), 0) / count
    );

    // Dominant sentiment = most common sentiment among matching calls
    const sentimentCounts = {};
    for (const c of matchingCalls) {
      const s = c.sentiment ?? 'neutral';
      sentimentCounts[s] = (sentimentCounts[s] ?? 0) + 1;
    }
    const dominant = Object.entries(sentimentCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';

    return {
      topic_id:            topic.id,
      call_count:          count,
      avg_sentiment_score: avgScore,
      dominant_sentiment:  dominant,
      topics:              topic,
    };
  }).sort((a, b) => b.call_count - a.call_count);
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
    word:           row.word,
    frequency:      row.frequency ?? 1,
    weight:         row.weight ?? 1,
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
