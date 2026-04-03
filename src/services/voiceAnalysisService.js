import { supabase } from '../lib/supabase';

// ─── Recent Analyses (completed calls) ───────────────────────────────────────
export async function fetchRecentAnalyses(limit = 10) {
  const { data, error } = await supabase
    .from('call_recordings')
    .select('id, call_ref, file_name, file_format, sentiment, sentiment_score, sentiment_confidence, duration_seconds, processed_at, status')
    .eq('status', 'completed')
    .order('processed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id:             row.id,
    fileName:       row.file_name ?? row.call_ref,
    sentiment:      row.sentiment ? capitalize(row.sentiment) : 'Unknown',
    sentimentScore: Math.round(row.sentiment_score ?? 0),
    confidence:     Math.round(row.sentiment_confidence ?? 0),
    completedAt:    new Date(row.processed_at),
    duration:       formatDuration(row.duration_seconds),
    status:         row.status,
  }));
}

// ─── Processing Queue ─────────────────────────────────────────────────────────
export async function fetchProcessingQueue(userId) {
  let query = supabase
    .from('processing_queue')
    .select('*')
    .in('status', ['pending', 'processing']);

  if (userId) query = query.eq('submitted_by', userId);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ─── Add file to processing queue ────────────────────────────────────────────
export async function enqueueFile({ fileName, fileFormat, fileSizeBytes, source = 'upload', submittedBy }) {
  const { data, error } = await supabase
    .from('processing_queue')
    .insert({
      file_name:       fileName,
      file_format:     fileFormat?.toLowerCase().replace('.', ''),
      file_size_bytes: fileSizeBytes,
      source,
      submitted_by:    submittedBy,
      status:          'pending',
      progress_pct:    0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Update queue item progress ───────────────────────────────────────────────
export async function updateQueueProgress(queueId, progressPct, status) {
  const updates = { progress_pct: progressPct };
  if (status) updates.status = status;
  if (status === 'processing' && !updates.started_at) updates.started_at = new Date().toISOString();
  if (status === 'completed')   updates.completed_at = new Date().toISOString();

  const { error } = await supabase
    .from('processing_queue')
    .update(updates)
    .eq('id', queueId);

  if (error) throw error;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
