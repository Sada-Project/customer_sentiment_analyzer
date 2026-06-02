/**
 * Gemini AI Service — Customer Sentiment Analyzer
 * Uses Gemini REST API directly (no SDK dependency issues)
 */

import { supabase } from '../lib/supabase';

const API_KEY  = (import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
const BASE_URL = 'https://generativelanguage.googleapis.com';

// ── Fallback models (tried in order if auto-discovery fails) ──────────────────
const MODELS = [
  { version: 'v1beta', name: 'gemini-2.5-flash-preview-05-20' },
  { version: 'v1beta', name: 'gemini-2.5-flash'               },
  { version: 'v1beta', name: 'gemini-2.5-pro'                 },
  { version: 'v1beta', name: 'gemini-2.0-flash-lite'          },
  { version: 'v1beta', name: 'gemini-1.5-flash'               },
  { version: 'v1beta', name: 'gemini-1.5-flash-8b'            },
  { version: 'v1beta', name: 'gemini-1.5-pro'                 },
  { version: 'v1',     name: 'gemini-1.5-flash'               },
];

let _model = null; // cached after first successful call

// ─────────────────────────────────────────────────────────────────────────────
// Core REST caller — tries all models until one works
// ─────────────────────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  if (!API_KEY || API_KEY === 'your-gemini-api-key-here') {
    throw new Error('Gemini API key not set in .env');
  }

  // If we already have a working model cached, use it directly
  if (_model) {
    const result = await _tryModel(_model, prompt);
    if (result.ok) return result.text;
    // If cached model fails, reset and re-discover
    console.warn('[Gemini] Cached model failed, re-discovering…');
    _model = null;
  }

  // Step 1: Auto-discover models available for this API key
  let candidates = [...MODELS]; // fallback list
  try {
    const res  = await fetch(`${BASE_URL}/v1beta/models?key=${API_KEY}`);
    if (res.ok) {
      const { models = [] } = await res.json();
      const usable = models
        .filter(m =>
          m.supportedGenerationMethods?.includes('generateContent') &&
          !m.name.includes('embedding') &&
          !m.name.includes('aqa')
        )
        .map(m => ({ version: 'v1beta', name: m.name.replace('models/', '') }));

      if (usable.length > 0) {
        // Put flash models first, then the rest
        const flash = usable.filter(m => m.name.includes('flash'));
        const others = usable.filter(m => !m.name.includes('flash'));
        candidates = [...flash, ...others, ...MODELS];
        console.info('[Gemini] Discovered models:', usable.map(m => m.name));
      }
    }
  } catch (e) {
    console.warn('[Gemini] Auto-discovery failed, using fallback list.', e.message);
  }

  // Step 2: Try each candidate until one works
  let lastError = 'No models tried';
  for (const target of candidates) {
    const result = await _tryModel(target, prompt);
    if (result.ok) {
      _model = target; // cache the winner
      console.info(`[Gemini] ✅ Working model: ${target.version}/${target.name}`);
      return result.text;
    }
    lastError = result.error;
    console.warn(`[Gemini] ✗ ${target.version}/${target.name}: ${lastError}`);
  }

  throw new Error(`Gemini generation failed. Details: ${lastError}`);
}

// Helper: attempt a single model
async function _tryModel(target, prompt) {
  try {
    const url = `${BASE_URL}/${target.version}/models/${target.name}:generateContent?key=${API_KEY}`;
    const res  = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        // safetySettings intentionally omitted — causes 400 on some models
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err?.error?.message ?? `HTTP ${res.status}` };
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) return { ok: false, error: 'Empty response from model' };

    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO TRANSCRIPTION — converts audio Blob to text via Gemini multimodal
// ─────────────────────────────────────────────────────────────────────────────
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Models that support audio/multimodal input — tried in order
const AUDIO_MODELS = [
  { version: 'v1beta', name: 'gemini-2.5-flash-preview-05-20' },
  { version: 'v1beta', name: 'gemini-2.5-flash'               },
  { version: 'v1beta', name: 'gemini-2.5-pro'                 },
  { version: 'v1beta', name: 'gemini-1.5-flash-latest'        },
  { version: 'v1beta', name: 'gemini-1.5-flash'               },
  { version: 'v1beta', name: 'gemini-1.5-flash-002'           },
  { version: 'v1beta', name: 'gemini-1.5-pro-latest'          },
  { version: 'v1beta', name: 'gemini-1.5-pro'                 },
];

// Normalize MIME type — strip codec params, fix common aliases
function normalizeMime(type) {
  const base = (type || 'audio/webm').split(';')[0].trim().toLowerCase();
  if (base === 'audio/mp3') return 'audio/mpeg';
  return base;
}

// ── Upload audio to Gemini Files API, return file URI ────────────────────────
async function uploadAudioFile(blob, mimeType, onProgress) {
  onProgress('جارٍ رفع الملف الصوتي…');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=media&key=${API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': mimeType },
      body:    blob,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Files API: ${err?.error?.message ?? `HTTP ${res.status}`}`);
  }

  const data = await res.json();
  const file = data?.file;
  const uri  = file?.uri;
  const name = file?.name; // e.g. "files/abc123"

  if (!uri) throw new Error('Files API: no URI in response');

  // Wait for file to become ACTIVE (sometimes starts as PROCESSING)
  if (file?.state === 'PROCESSING' && name) {
    onProgress('جارٍ معالجة الملف الصوتي…');
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const chk = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${name}?key=${API_KEY}`
      );
      const chkData = await chk.json();
      if (chkData?.state === 'ACTIVE') break;
      if (chkData?.state === 'FAILED') throw new Error('File processing failed by Gemini');
    }
  }

  console.info('[Gemini Files] ✅ uploaded:', uri);
  return uri;
}

export async function transcribeAudio(audioBlob, onProgress = () => {}) {
  if (!API_KEY || API_KEY === 'your-gemini-api-key-here') {
    throw new Error('Gemini API key not set in .env');
  }
  if (!audioBlob || audioBlob.size === 0) throw new Error('ملف الصوت فارغ أو غير موجود.');
  if (audioBlob.size > 50 * 1024 * 1024) throw new Error('حجم الملف يتجاوز الحد المسموح (50MB). يرجى استخدام ملف أصغر.');

  const mimeType = normalizeMime(audioBlob.type);
  console.info('[Gemini Audio] Starting transcription, size:', audioBlob.size, 'mime:', mimeType);

  const transcriptionPrompt = `You are a professional transcription engine for a call center.
Transcribe ALL speech in this audio VERBATIM — word for word, exactly as spoken.
Support Arabic (العربية) and English including mixed speech (code-switching).
If there are multiple speakers label them: "Speaker 1: ..." / "Speaker 2: ..."
Do NOT summarize, translate, or add commentary.
Output ONLY the transcript text — nothing else.`;

  let lastError = 'No audio-capable models available';

  // ── Strategy 1: Gemini Files API (recommended for audio) ─────────────────
  try {
    const fileUri = await uploadAudioFile(audioBlob, mimeType, onProgress);

    if (fileUri) {
      // Use uploaded file URI instead of inline base64
      for (const model of AUDIO_MODELS) {
        try {
          const url = `${BASE_URL}/${model.version}/models/${model.name}:generateContent?key=${API_KEY}`;
          const res = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { file_data: { mime_type: mimeType, file_uri: fileUri } },
                  { text: transcriptionPrompt },
                ],
              }],
              generationConfig: { temperature: 0.0, maxOutputTokens: 8192 },
            }),
          });

          if (!res.ok) {
            const errBody = await res.json().catch(() => ({}));
            const msg = errBody?.error?.message ?? `HTTP ${res.status}`;
            console.warn(`[Gemini Audio Files] ✗ ${model.name}: ${msg}`);
            lastError = msg;
            continue;
          }

          const data       = await res.json();
          const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

          if (!transcript) {
            lastError = 'Empty response from model';
            console.warn(`[Gemini Audio Files] ✗ ${model.name}: empty response`);
            continue;
          }

          console.info(`[Gemini Audio Files] ✅ Transcribed with ${model.name}`);
          onProgress('تم استخراج النص ✅');
          return { transcript, word_count: transcript.split(/\s+/).filter(Boolean).length };

        } catch (e) {
          lastError = e.message;
          console.warn(`[Gemini Audio Files] ✗ ${model.name}: ${e.message}`);
        }
      }
    }
  } catch (uploadErr) {
    console.warn('[Gemini Audio] Files API upload failed, trying inline:', uploadErr.message);
    lastError = uploadErr.message;
  }

  // ── Strategy 2: Inline base64 (fallback) ──────────────────────────────────
  if (audioBlob.size <= 15 * 1024 * 1024) {
    onProgress('جارٍ تحويل الصوت (طريقة بديلة)…');
    const base64 = await blobToBase64(audioBlob);

    for (const model of AUDIO_MODELS) {
      try {
        const url = `${BASE_URL}/${model.version}/models/${model.name}:generateContent?key=${API_KEY}`;
        const res = await fetch(url, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: mimeType, data: base64 } },
                { text: transcriptionPrompt },
              ],
            }],
            generationConfig: { temperature: 0.0, maxOutputTokens: 8192 },
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const msg = errBody?.error?.message ?? `HTTP ${res.status}`;
          console.warn(`[Gemini Audio Inline] ✗ ${model.name}: ${msg}`);
          lastError = msg;
          continue;
        }

        const data       = await res.json();
        const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';

        if (!transcript) { lastError = 'Empty response'; continue; }

        console.info(`[Gemini Audio Inline] ✅ Transcribed with ${model.name}`);
        onProgress('تم استخراج النص ✅');
        return { transcript, word_count: transcript.split(/\s+/).filter(Boolean).length };

      } catch (e) {
        lastError = e.message;
        console.warn(`[Gemini Audio Inline] ✗ ${model.name}: ${e.message}`);
      }
    }
  }

  throw new Error(`فشل التحويل الصوتي: ${lastError}`);
}



// ── Helper: parse JSON from Gemini response ────────────────────────────────────
function parseJSON(text, fallback) {
  try {
    // 1. Strip markdown code fences
    let clean = text
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // 2. Try direct parse first
    try { return JSON.parse(clean); } catch {}

    // 3. Extract first JSON object {...} or array [...]
    const objMatch   = clean.match(/\{[\s\S]*\}/);
    const arrMatch   = clean.match(/\[[\s\S]*\]/);

    // Pick whichever comes first in the text
    const candidates = [objMatch, arrMatch]
      .filter(Boolean)
      .sort((a, b) => clean.indexOf(a[0]) - clean.indexOf(b[0]));

    for (const match of candidates) {
      try { return JSON.parse(match[0]); } catch {}
    }

    console.warn('[Gemini] parseJSON: could not extract JSON from:', clean.slice(0, 200));
    return fallback;
  } catch {
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CHECK CONNECTION
// ─────────────────────────────────────────────────────────────────────────────
export async function checkGeminiConnection() {
  try {
    const text = await callGemini('Reply with the single word: OK');
    return {
      connected: true,
      model:     `${_model?.version}/${_model?.name}`,
      response:  text.trim(),
    };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SENTIMENT ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeSentiment(transcript) {
  const prompt = `
You are a customer service sentiment analyst. Analyze this call transcript.

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY valid JSON (no markdown, no extra text):
{
  "sentiment": "satisfied",
  "sentiment_score": 72,
  "sentiment_confidence": 88,
  "emotion_breakdown": { "satisfied": 40, "neutral": 35, "frustrated": 15, "angry": 10 },
  "reasoning": "Brief explanation here."
}

Rules:
- sentiment must be one of: satisfied, neutral, frustrated, angry
- sentiment_score: 0=very negative, 100=very positive
- emotion_breakdown values must sum to 100
`;

  const text = await callGemini(prompt);
  return parseJSON(text, {
    sentiment:            'neutral',
    sentiment_score:      50,
    sentiment_confidence: 60,
    emotion_breakdown:    { satisfied: 25, neutral: 50, frustrated: 15, angry: 10 },
    reasoning:            'Could not parse AI response.',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CALL SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
export async function generateCallSummary(transcript, meta = {}) {
  const prompt = `
Summarize this customer service call concisely.

Customer: ${meta.customerName ?? 'Unknown'}
Agent: ${meta.agentName ?? 'Unknown'}
Duration: ${meta.duration ?? 'Unknown'}

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY valid JSON:
{
  "summary": "2-3 sentence summary here.",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "resolution_status": "resolved",
  "follow_up_required": false,
  "follow_up_note": null
}

resolution_status must be one of: resolved, unresolved, escalated, follow_up_needed
`;

  const text = await callGemini(prompt);
  return parseJSON(text, {
    summary:            'Summary unavailable.',
    key_points:         [],
    resolution_status:  'unresolved',
    follow_up_required: false,
    follow_up_note:     null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. TOPIC EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────
export async function extractTopics(transcript) {
  const prompt = `
Identify the main topics in this customer service call (max 6).

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY a valid JSON array:
[
  { "name": "Billing", "relevance_score": 0.9, "category": "billing" },
  { "name": "Refund", "relevance_score": 0.7, "category": "billing" }
]

category must be one of: billing, technical, service, product, account, logistics
`;

  const text = await callGemini(prompt);
  return parseJSON(text, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4b. PROBLEM & SOLUTION EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────
export async function extractProblemAndSolution(transcript) {
  const prompt = `
You are a customer service analyst. Analyze this call transcript and identify:
1. The main problem the customer is facing
2. A clear, actionable solution recommendation for the agent/support team

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY valid JSON (no markdown):
{
  "problem": "Brief description of the main problem (1-2 sentences)",
  "problem_category": "one of: billing, technical, service, product, account, other",
  "severity": "one of: low, medium, high, critical",
  "solution": "Clear actionable recommendation to solve the problem (1-2 sentences)",
  "solution_type": "one of: immediate_action, escalation, follow_up, information, refund, technical_fix"
}
`;
  const text = await callGemini(prompt);
  return parseJSON(text, null);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. KEYWORD EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────
export async function extractKeywords(transcript) {
  const prompt = `
Extract important keywords from this customer service call (max 15).

TRANSCRIPT:
"""
${transcript}
"""

Return ONLY a valid JSON array:
[
  { "word": "refund", "frequency": 3, "sentiment_bias": "frustrated", "weight": 2.1 }
]

sentiment_bias must be one of: satisfied, neutral, frustrated, angry
`;

  const text = await callGemini(prompt);
  return parseJSON(text, []);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. QA SCRIPT COMPLIANCE
// ─────────────────────────────────────────────────────────────────────────────
export async function checkScriptCompliance(transcript, criteria) {
  const criteriaList = criteria.map((c, i) => `${i + 1}. ${c.title}: ${c.description}`).join('\n');
  const prompt = `
Check if the agent followed these QA criteria in the call.

TRANSCRIPT:
"""
${transcript}
"""

CRITERIA:
${criteriaList}

Return ONLY a valid JSON array (one entry per criterion in order):
[{ "criteria_index": 1, "passed": true, "details": "Agent said the greeting." }]
`;

  const text   = await callGemini(prompt);
  const parsed = parseJSON(text, []);
  return parsed.map((item, i) => ({
    criteria_id: criteria[item.criteria_index - 1]?.id ?? criteria[i]?.id,
    passed:      item.passed,
    details:     item.details,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. FULL CALL ANALYSIS + save to Supabase
// ─────────────────────────────────────────────────────────────────────────────
export async function analyzeCallFull(params, onProgress = () => {}) {
  const { callId, transcript, customerName, agentName, interactionType, duration } = params;
  if (!transcript?.trim()) throw new Error('Transcript is empty.');

  onProgress('Analyzing sentiment…', 20);
  const sentimentResult = await analyzeSentiment(transcript);

  onProgress('Generating AI summary…', 40);
  const summaryResult   = await generateCallSummary(transcript, { customerName, agentName, interactionType, duration });

  onProgress('Extracting topics…', 60);
  const topicsResult    = await extractTopics(transcript);

  onProgress('Extracting keywords…', 80);
  const keywordsResult  = await extractKeywords(transcript);

  if (callId) {
    onProgress('Saving to database…', 90);

    // ── 1. Save core call data ─────────────────────────────────────────────────
    await supabase.from('call_recordings').update({
      sentiment:              sentimentResult.sentiment,
      sentiment_score:        sentimentResult.sentiment_score,
      sentiment_confidence:   sentimentResult.sentiment_confidence,
      ai_summary:             summaryResult.summary,
      transcript_text:        transcript,
      status:                 'completed',
      processed_at:           new Date().toISOString(),
      processing_duration_ms: Date.now() - (params._startedAt ?? Date.now()),
    }).eq('id', callId);

    // ── 2. Save topics → topics master table (upsert by name) ─────────────────
    // topics has: id (uuid), name (text UNIQUE), category (text),
    //             color (text), icon_name (text), description (text)
    // We only upsert name + category — color/icon keep existing values.
    if (topicsResult?.length > 0) {
      try {
        for (const topic of topicsResult) {
          if (!topic?.name?.trim()) continue;
          const { error: upsertErr } = await supabase
            .from('topics')
            .upsert(
              { name: topic.name.trim(), category: topic.category ?? 'service' },
              { onConflict: 'name', ignoreDuplicates: false }
            );
          if (upsertErr) console.warn('[Topics]', upsertErr.message);
        }
      } catch (e) {
        console.warn('[Gemini] Topic save error (non-fatal):', e.message);
      }
    }

    // ── 3. Save keywords → keywords table (upsert by word) ─────────────────────
    // keywords has: id (uuid), word (text UNIQUE), sentiment_bias (sentiment_type),
    //               frequency (int), weight (decimal), created_at, updated_at
    if (keywordsResult?.length > 0) {
      try {
        for (const kw of keywordsResult) {
          if (!kw?.word?.trim()) continue;
          const wordLower = kw.word.toLowerCase().trim();

          const { data: existing } = await supabase
            .from('keywords')
            .select('id, frequency')
            .eq('word', wordLower)
            .maybeSingle();

          if (existing) {
            await supabase.from('keywords').update({
              frequency:      (existing.frequency ?? 0) + (kw.frequency ?? 1),
              weight:         kw.weight ?? 1,
              sentiment_bias: kw.sentiment_bias ?? 'neutral',
            }).eq('id', existing.id);
          } else {
            const { error: insErr } = await supabase.from('keywords').insert({
              word:           wordLower,
              frequency:      kw.frequency ?? 1,
              weight:         kw.weight ?? 1,
              sentiment_bias: kw.sentiment_bias ?? 'neutral',
            });
            if (insErr) console.warn('[Keywords insert]', insErr.message);
          }
        }
      } catch (e) {
        console.warn('[Gemini] Keyword save error (non-fatal):', e.message);
      }
    }
  }

  onProgress('Done!', 100);
  return { sentiment: sentimentResult, summary: summaryResult, topics: topicsResult, keywords: keywordsResult };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. CHAT
// ─────────────────────────────────────────────────────────────────────────────
export async function chatAboutCall(message, context = '') {
  const prompt = context
    ? `You are a customer service analytics assistant.\n\nCALL CONTEXT:\n${context}\n\nUser question: ${message}`
    : `You are a customer service analytics assistant.\n\nUser question: ${message}`;
  return callGemini(prompt);
}
