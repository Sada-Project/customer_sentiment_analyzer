import { supabase } from '../lib/supabase';

// ─── Recent Analyses (completed calls) ───────────────────────────────────────
export async function fetchRecentAnalyses(limit = 10) {
  const { data, error } = await supabase
    .from('call_recordings')
    .select('id, call_ref, file_name, file_format, sentiment, sentiment_score, sentiment_confidence, duration_seconds, processed_at, status, ai_summary, transcript_text, audio_url')
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
    aiSummary:      row.ai_summary ?? null,
    transcript:     row.transcript_text ?? null,
    audioUrl:       row.audio_url ?? null,
  }));
}

// ─── Create a new call_recordings row before processing ──────────────────────
export async function createCallRecord({ fileName, fileFormat, fileSizeBytes, submittedBy }) {
  const { data, error } = await supabase
    .from('call_recordings')
    .insert({
      file_name:       fileName,
      file_format:     fileFormat?.toLowerCase().replace('.', ''),
      file_size_bytes: fileSizeBytes,
      status:          'processing',
      processing_started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id; // return the UUID to use for updates
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

// ─── Upload audio file to Supabase Storage ────────────────────────────────────
export async function uploadAudioToStorage(audioBlob, callId, fileName) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path     = `${callId}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('call-audio')
    .upload(path, audioBlob, {
      contentType: audioBlob.type || 'audio/webm',
      upsert:      true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('call-audio').getPublicUrl(path);
  return data.publicUrl;
}

// ─── Save audio URL back to call_recordings ───────────────────────────────────
export async function saveAudioUrl(callId, audioUrl) {
  const { error } = await supabase
    .from('call_recordings')
    .update({ audio_url: audioUrl })
    .eq('id', callId);
  if (error) throw error;
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

// ─── Delete recordings by IDs (DB + Storage) ─────────────────────────────────
export async function deleteRecordings(ids) {
  if (!ids?.length) return;

  // 1. Fetch audio_url for each to also delete from Storage
  const { data: rows } = await supabase
    .from('call_recordings')
    .select('id, audio_url')
    .in('id', ids);

  // 2. Delete from Storage (best-effort)
  if (rows?.length) {
    const paths = rows
      .filter(r => r.audio_url)
      .map(r => {
        try {
          const url  = new URL(r.audio_url);
          const parts = url.pathname.split('/call-audio/');
          return parts[1] ?? null;
        } catch { return null; }
      })
      .filter(Boolean);

    if (paths.length) {
      await supabase.storage.from('call-audio').remove(paths).catch(() => {});
    }
  }

  // 3. Delete from DB
  const { error } = await supabase
    .from('call_recordings')
    .delete()
    .in('id', ids);

  if (error) throw error;
}
