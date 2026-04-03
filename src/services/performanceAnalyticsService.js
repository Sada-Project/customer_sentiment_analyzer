import { supabase } from '../lib/supabase';

// ─── KPI Metric Cards ─────────────────────────────────────────────────────────
export async function fetchPerformanceKPIs() {
  const keys = ['processing_accuracy', 'transcription_confidence', 'sentiment_confidence', 'script_adherence'];
  const { data, error } = await supabase
    .from('kpi_snapshots')
    .select('*')
    .in('metric_key', keys)
    .order('recorded_at', { ascending: false });

  if (error) throw error;

  // Return only the latest entry per metric_key
  const seen = new Set();
  return (data ?? []).filter((row) => {
    if (seen.has(row.metric_key)) return false;
    seen.add(row.metric_key);
    return true;
  });
}

// ─── Performance Timeline Chart ───────────────────────────────────────────────
export async function fetchPerformanceMetrics(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('performance_metrics')
    .select('*')
    .gte('time_bucket', since)
    .order('time_bucket', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    time: new Date(row.time_bucket).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    }),
    filesUploaded:   row.files_uploaded,
    filesProcessed:  row.files_processed,
    accuracy:        row.avg_accuracy,
    scriptAdherence: row.avg_script_adherence,
  }));
}

// ─── System Health Gauges ─────────────────────────────────────────────────────
export async function fetchSystemHealth() {
  const { data, error } = await supabase
    .from('system_health_metrics')
    .select('*')
    .order('recorded_at', { ascending: false });

  if (error) throw error;

  // Latest per metric_name
  const seen = new Set();
  return (data ?? []).filter((row) => {
    if (seen.has(row.metric_name)) return false;
    seen.add(row.metric_name);
    return true;
  });
}

// ─── Alert Panel ──────────────────────────────────────────────────────────────
export async function fetchPerformanceAlerts(limit = 5) {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .in('source', ['performance', 'system'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ─── Acknowledge alert ────────────────────────────────────────────────────────
export async function acknowledgeAlert(alertId, userId) {
  const { error } = await supabase
    .from('alerts')
    .update({ acknowledged: true, acknowledged_by: userId, acknowledged_at: new Date().toISOString() })
    .eq('id', alertId);

  if (error) throw error;
}
