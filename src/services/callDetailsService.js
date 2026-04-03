import { supabase } from '../lib/supabase';

// ─── Call Details (full) ──────────────────────────────────────────────────────
export async function fetchCallById(callId) {
  const { data, error } = await supabase
    .from('call_recordings')
    .select(`
      *,
      customers (customer_ref, full_name, company_name, segment),
      agents    (name, email, role_title)
    `)
    .eq('id', callId)
    .single();

  if (error) throw error;
  return data;
}

// Also support lookup by call_ref (e.g. 'CALL-20260101-001')
export async function fetchCallByRef(callRef) {
  const { data, error } = await supabase
    .from('call_recordings')
    .select(`
      *,
      customers (customer_ref, full_name, company_name, segment),
      agents    (name, email, role_title)
    `)
    .eq('call_ref', callRef)
    .single();

  if (error) throw error;
  return data;
}

// ─── Conversation Transcript ──────────────────────────────────────────────────
export async function fetchTranscript(callId) {
  const { data, error } = await supabase
    .from('call_transcript_segments')
    .select('*')
    .eq('call_id', callId)
    .order('segment_index', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Smart Topics for call ────────────────────────────────────────────────────
export async function fetchCallTopics(callId) {
  const { data, error } = await supabase
    .from('call_topics')
    .select('relevance_score, topics(name, icon_name, category)')
    .eq('call_id', callId)
    .order('relevance_score', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    tag:   `#${row.topics?.name?.replace(/\s+/g, '')}`,
    icon:  row.topics?.icon_name,
    score: row.relevance_score,
  }));
}

// ─── QA Checklist for call ────────────────────────────────────────────────────
export async function fetchCallQA(callId) {
  const { data, error } = await supabase
    .from('call_qa_results')
    .select('*, qa_criteria(title, description, category, display_order)')
    .eq('call_id', callId)
    .order('qa_criteria(display_order)');

  if (error) throw error;
  return (data ?? []).map((row) => ({
    item:        row.qa_criteria?.title,
    description: row.qa_criteria?.description,
    status:      row.passed ? 'pass' : 'fail',
    details:     row.details,
  }));
}
