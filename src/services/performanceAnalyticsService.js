import { supabase } from '../lib/supabase';

// ─── KPI Metric Cards ─────────────────────────────────────────────────────────
// All metrics are computed live from real call data so every new upload updates them.
export async function fetchPerformanceKPIs() {

  // Fetch everything in parallel
  const [recordingsRes, qaRes, perfRes] = await Promise.all([
    // All calls: status + confidence + transcript presence
    supabase
      .from('call_recordings')
      .select('status, sentiment_confidence, transcript_text')
      .order('created_at', { ascending: false }),

    // QA results for Script Adherence
    supabase
      .from('call_qa_results')
      .select('passed'),

    // Fallback for script_adherence if no QA data
    supabase
      .from('performance_metrics')
      .select('avg_script_adherence')
      .order('time_bucket', { ascending: false })
      .limit(50),
  ]);

  const allCalls      = recordingsRes.data ?? [];
  const completedCalls = allCalls.filter((r) => r.status === 'completed');
  const totalCalls    = allCalls.length;
  const result        = [];

  // ── helper ────────────────────────────────────────────────────────────────
  const avgOf = (arr) => {
    const valid = arr.filter((v) => v != null && !isNaN(Number(v)));
    return valid.length ? valid.reduce((s, v) => s + Number(v), 0) / valid.length : null;
  };
  const round1 = (n) => Math.round(n * 10) / 10;

  // ── 1. Processing Accuracy ────────────────────────────────────────────────
  // = completed calls ÷ total uploaded × 100
  if (totalCalls > 0) {
    result.push({
      metric_key:   'processing_accuracy',
      metric_label: 'Processing Accuracy',
      metric_value: round1((completedCalls.length / totalCalls) * 100),
      metric_unit:  '%',
      change_value: null,
      change_type:  'positive',
    });
  }

  // ── 2. Transcription Confidence ───────────────────────────────────────────
  // = calls that have a real transcript ÷ completed calls × 100
  if (completedCalls.length > 0) {
    const withTranscript = completedCalls.filter(
      (r) => r.transcript_text && r.transcript_text.trim().length > 10
    ).length;
    result.push({
      metric_key:   'transcription_confidence',
      metric_label: 'Transcription Confidence',
      metric_value: round1((withTranscript / completedCalls.length) * 100),
      metric_unit:  '%',
      change_value: null,
      change_type:  'positive',
    });
  }

  // ── 3. Sentiment Confidence ───────────────────────────────────────────────
  // = avg(sentiment_confidence) across completed calls
  const confValues = completedCalls
    .map((r) => r.sentiment_confidence)
    .filter((v) => v != null);

  const avgSentConf = confValues.length > 0
    ? avgOf(confValues)
    : null; // nothing in call_recordings yet

  if (avgSentConf != null) {
    result.push({
      metric_key:   'sentiment_confidence',
      metric_label: 'Sentiment Confidence',
      metric_value: round1(avgSentConf),
      metric_unit:  '%',
      change_value: null,
      change_type:  'positive',
    });
  }

  // ── 4. Script Adherence Rate ──────────────────────────────────────────────
  // Primary: passed QA criteria ÷ total QA evaluations × 100
  const qaRows = qaRes.data ?? [];
  if (qaRows.length > 0) {
    const passed    = qaRows.filter((r) => r.passed).length;
    const adherence = round1((passed / qaRows.length) * 100);
    result.push({
      metric_key:   'script_adherence',
      metric_label: 'Script Adherence Rate',
      metric_value: adherence,
      metric_unit:  '%',
      change_value: null,
      change_type:  'positive',
    });
  } else {
    // Fallback: avg from performance_metrics seed data
    const perfAdh = avgOf((perfRes.data ?? []).map((r) => r.avg_script_adherence));
    if (perfAdh != null) {
      result.push({
        metric_key:   'script_adherence',
        metric_label: 'Script Adherence Rate',
        metric_value: round1(perfAdh),
        metric_unit:  '%',
        change_value: null,
        change_type:  'positive',
      });
    }
  }

  // Return in consistent display order
  const order = ['processing_accuracy', 'transcription_confidence', 'sentiment_confidence', 'script_adherence'];
  return order
    .map((k) => result.find((r) => r.metric_key === k))
    .filter(Boolean);
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
