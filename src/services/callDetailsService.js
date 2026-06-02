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
    tag:      `#${row.topics?.name?.replace(/\s+/g, '')}`,
    name:     row.topics?.name,
    icon:     row.topics?.icon_name,
    score:    row.relevance_score,
    category: row.topics?.category,
  }));
}

// ─── Save AI-extracted topics → topics master + call_topics junction ──────────
export async function saveCallTopics(callId, aiTopics) {
  if (!callId || !aiTopics?.length) return;
  for (const topic of aiTopics) {
    if (!topic?.name?.trim()) continue;
    try {
      // 1. Upsert in master topics table (name is UNIQUE)
      const { data: topicRow, error: e1 } = await supabase
        .from('topics')
        .upsert(
          { name: topic.name.trim(), category: topic.category ?? 'service' },
          { onConflict: 'name', ignoreDuplicates: false }
        )
        .select('id')
        .single();

      // Resolve topic ID (try upsert, fallback to select)
      let tid = topicRow?.id;
      if (!tid) {
        const { data: existing } = await supabase
          .from('topics').select('id').eq('name', topic.name.trim()).maybeSingle();
        tid = existing?.id;
        if (!tid) { console.warn('[saveCallTopics] topic not found:', e1?.message); continue; }
      }

      // 2. Link to this call — check first to avoid duplicate errors
      const { data: linked } = await supabase
        .from('call_topics').select('id').eq('call_id', callId).eq('topic_id', tid).maybeSingle();

      if (linked?.id) {
        // Already linked — just update relevance score
        await supabase.from('call_topics')
          .update({ relevance_score: topic.relevance_score ?? 0.5 })
          .eq('id', linked.id);
      } else {
        // New link
        const { error: e3 } = await supabase.from('call_topics').insert({
          call_id:         callId,
          topic_id:        tid,
          relevance_score: topic.relevance_score ?? 0.5,
        });
        if (e3) console.warn('[saveCallTopics insert]', e3.message);
      }
    } catch (e) {
      console.warn('[saveCallTopics]', e.message);
    }
  }
  console.info('[saveCallTopics] ✅ saved', aiTopics.length, 'topics for call', callId);
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

// ─── Save script compliance results → qa_criteria + call_qa_results ───────────
export async function saveCallCompliance(callId, results, criteriaList) {
  if (!callId || !results?.length) return;
  for (const res of results) {
    const criterion = criteriaList.find(c => c.id === res.criteria_id);
    if (!criterion) continue;
    try {
      // Find or create the qa_criteria row (by title)
      let { data: crit } = await supabase
        .from('qa_criteria')
        .select('id')
        .eq('title', criterion.title)
        .maybeSingle();

      if (!crit?.id) {
        const { data: newCrit, error: insErr } = await supabase
          .from('qa_criteria')
          .insert({
            title:         criterion.title,
            description:   criterion.description,
            category:      'quality',
            display_order: criteriaList.indexOf(criterion) + 1,
          })
          .select('id')
          .single();
        if (insErr) { console.warn('[saveCallCompliance criteria]', insErr.message); continue; }
        crit = newCrit;
      }

      if (crit?.id) {
        const { error: e } = await supabase
          .from('call_qa_results')
          .upsert(
            { call_id: callId, criteria_id: crit.id, passed: res.passed, details: res.details ?? '' },
            { onConflict: 'call_id,criteria_id' }
          );
        if (e) console.warn('[saveCallCompliance result]', e.message);
      }
    } catch (e) {
      console.warn('[saveCallCompliance]', e.message);
    }
  }
}

// ─── localStorage cache for Problem & Solution (no dedicated DB table) ────────
const PS_CACHE_KEY = 'ps_analysis_v1';
const PS_TTL_MS    = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getCachedPS(callId) {
  try {
    const cache = JSON.parse(localStorage.getItem(PS_CACHE_KEY) ?? '{}');
    const entry = cache[callId];
    if (entry && Date.now() - entry.t < PS_TTL_MS) return entry.d;
  } catch {}
  return null;
}

export function setCachedPS(callId, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(PS_CACHE_KEY) ?? '{}');
    cache[callId] = { d: data, t: Date.now() };
    // Limit to 50 entries to avoid storage overflow
    const keys = Object.keys(cache);
    if (keys.length > 50) {
      const oldest = keys.sort((a, b) => cache[a].t - cache[b].t)[0];
      delete cache[oldest];
    }
    localStorage.setItem(PS_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}
