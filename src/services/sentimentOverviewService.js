import { supabase } from '../lib/supabase';

// ─── KPI Cards ────────────────────────────────────────────────────────────────
export async function fetchKPIs(timePeriod = '24h') {
  const { data, error } = await supabase
    .from('vw_dashboard_kpis')
    .select('*')
    .eq('time_period', timePeriod);

  if (error) throw error;
  return data ?? [];
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
    time: new Date(row.time_bucket).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    }),
    satisfied:   row.satisfied_count,
    neutral:     row.neutral_count,
    frustrated:  row.frustrated_count,
    angry:       row.angry_count,
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
  return data ?? [];
}

// ─── Sentiment Distribution ───────────────────────────────────────────────────
export async function fetchSentimentDistribution(date) {
  const targetDate = date ?? new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('sentiment_distribution')
    .select('*')
    .eq('period_date', targetDate);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    name:       row.sentiment,
    value:      row.call_count,
    percentage: row.percentage,
  }));
}
