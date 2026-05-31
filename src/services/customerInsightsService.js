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
export async function fetchTopicFrequency(date) {
  const targetDate = date ?? new Date().toISOString().split('T')[0];

  let { data, error } = await supabase
    .from('topic_frequency')
    .select('*, topics(name, color, icon_name, category)')
    .eq('period_date', targetDate)
    .order('call_count', { ascending: false });

  if (error) throw new Error(`Topic frequency fetch failed: ${error.message}`);

  // Fallback: if today has no data, get most recent
  if (!data || data.length === 0) {
    const fallback = await supabase
      .from('topic_frequency')
      .select('*, topics(name, color, icon_name, category)')
      .order('period_date', { ascending: false })
      .order('call_count',  { ascending: false })
      .limit(12);

    if (fallback.error) throw new Error(`Topic fallback failed: ${fallback.error.message}`);
    return fallback.data ?? [];
  }

  return data;
}

// ─── Keyword Word Cloud ───────────────────────────────────────────────────────
export async function fetchKeywords(limit = 50) {
  const { data, error } = await supabase
    .from('keywords')
    .select('word, frequency, weight, sentiment_bias')
    .order('frequency', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Keywords fetch failed: ${error.message}`);
  return data ?? [];
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
