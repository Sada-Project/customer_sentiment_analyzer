/**
 * Gemini AI Service — Customer Sentiment Analyzer
 * Uses Gemini REST API directly (no SDK dependency issues)
 */

import { supabase } from '../lib/supabase';

const API_KEY  = (import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
const BASE_URL = 'https://generativelanguage.googleapis.com';

// ── Fallback models (tried in order if auto-discovery fails) ──────────────────
const MODELS = [
  { version: 'v1beta', name: 'gemini-2.0-flash-lite'  },
  { version: 'v1beta', name: 'gemini-2.0-flash'       },
  { version: 'v1beta', name: 'gemini-1.5-flash'       },
  { version: 'v1beta', name: 'gemini-1.5-flash-8b'    },
  { version: 'v1beta', name: 'gemini-1.5-pro'         },
  { version: 'v1',     name: 'gemini-2.0-flash-lite'  },
  { version: 'v1',     name: 'gemini-1.5-flash'       },
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

export async function transcribeAudio(audioBlob, onProgress = () => {}) {
  if (!audioBlob || audioBlob.size === 0) throw new Error('ملف الصوت فارغ أو غير موجود.');
  if (audioBlob.size > 20 * 1024 * 1024)  throw new Error('حجم الملف يتجاوز الحد المسموح (20MB). يرجى استخدام ملف أصغر.');

  // Ensure a working model is cached first
  if (!_model) await callGemini('hi');
  if (!_model) throw new Error('لا يوجد نموذج Gemini متاح. تحقق من مفتاح الـ API.');

  onProgress('جارٍ تحويل الصوت…');
  const base64   = await blobToBase64(audioBlob);
  const mimeType = audioBlob.type || 'audio/webm';

  onProgress('جارٍ إرسال الصوت إلى Gemini AI…');
  const url = `${BASE_URL}/${_model.version}/models/${_model.name}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: `You are a professional transcription engine for a call center.
Transcribe ALL speech in this audio VERBATIM — word for word, exactly as spoken.
Support Arabic (العربية) and English including mixed speech (code-switching).
If there are multiple speakers label them: "Speaker 1: ..." / "Speaker 2: ..."
Do NOT summarize, translate, or add commentary.
Output ONLY the transcript text — nothing else.` },
        ],
      }],
      generationConfig: { temperature: 0.0, maxOutputTokens: 8192 },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`فشل التحويل: ${err?.error?.message ?? `HTTP ${res.status}`}`);
  }

  const data       = await res.json();
  const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!transcript) throw new Error('لم يُستخرج أي نص من الملف الصوتي.');

  onProgress('تم استخراج النص ✅');
  return { transcript, word_count: transcript.split(/\s+/).filter(Boolean).length };
}

// ── Helper: parse JSON from Gemini response ────────────────────────────────────
function parseJSON(text, fallback) {
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
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
    await supabase.from('call_recordings').update({
      sentiment:            sentimentResult.sentiment,
      sentiment_score:      sentimentResult.sentiment_score,
      sentiment_confidence: sentimentResult.sentiment_confidence,
      ai_summary:           summaryResult.summary,
      transcript_text:      transcript,          // ← persist full transcript
      status:               'completed',
      processed_at:         new Date().toISOString(),
      processing_duration_ms: Date.now() - (params._startedAt ?? Date.now()),
    }).eq('id', callId);
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
