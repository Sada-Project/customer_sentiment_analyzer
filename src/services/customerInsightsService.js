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
    if (sentimentThreshold === 'positive')   query = query.gte('sentiment', 70);
    if (sentimentThreshold === 'neutral')    query = query.gte('sentiment', 40).lt('sentiment', 70);
    if (sentimentThreshold === 'negative')   query = query.lt('sentiment', 40);
  }
  if (search) {
    query = query.ilike('customer_name', `%${search}%`);
  }

  const { data, error } = await query.order('last_interaction_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ─── Metric Cards (top of page) ───────────────────────────────────────────────
export async function fetchCustomerMetrics() {
  const { data, error } = await supabase
    .from('kpi_snapshots')
    .select('*')
    .in('metric_key', ['satisfaction_trend', 'overall_sentiment'])
    .order('recorded_at', { ascending: false })
    .limit(2);

  if (error) throw error;
  return data ?? [];
}

// ─── Sentiment Heatmap ────────────────────────────────────────────────────────
export async function fetchSentimentHeatmap(weekStart) {
  const start = weekStart ?? new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('sentiment_heatmap')
    .select('*')
    .eq('period_week_start', start);

  if (error) throw error;
  return data ?? [];
}

// ─── Sentiment Alert Feed ─────────────────────────────────────────────────────
export async function fetchSentimentAlerts(limit = 8) {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('source', 'sentiment')
    .eq('acknowledged', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ─── Topic Bubble Chart ───────────────────────────────────────────────────────
export async function fetchTopicFrequency(date) {
  const targetDate = date ?? new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('topic_frequency')
    .select('*, topics(name, color, icon_name, category)')
    .eq('period_date', targetDate)
    .order('call_count', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ─── Keyword Word Cloud ───────────────────────────────────────────────────────
export async function fetchKeywords(limit = 50) {
  const { data, error } = await supabase
    .from('keywords')
    .select('word, frequency, weight, sentiment_bias')
    .order('frequency', { ascending: false })
    .limit(limit);

  if (error) throw error;
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

  if (error) throw error;
  return data ?? [];
}
