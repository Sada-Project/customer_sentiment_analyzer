/**
 * Gemini AI Service — Customer Sentiment Analyzer
 * Uses Gemini REST API directly (no SDK dependency issues)
 */

import { supabase } from '../lib/supabase';

const API_KEY  = (import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
const BASE_URL = 'https://generativelanguage.googleapis.com';

// ── Models to try in order ─────────────────────────────────────────────────────
const MODELS = [
  { version: 'v1beta', name: 'gemini-1.5-flash' },
  { version: 'v1',     name: 'gemini-1.5-flash' }
];

let _model = null; // { version, name } — cached after first successful call

// ─────────────────────────────────────────────────────────────────────────────
// Core REST caller
// ─────────────────────────────────────────────────────────────────────────────
async function callGemini(prompt, modelOverride = null) {
  if (!API_KEY || API_KEY === 'your-gemini-api-key-here') {
    throw new Error('Gemini API key not set in .env');
  }

  let lastErrorMsg = null;

  // 1. Auto-discover available models if we haven't yet
  if (!_model) {
    try {
      const listUrl = `${BASE_URL}/v1beta/models?key=${API_KEY}`;
      const listRes = await fetch(listUrl);
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = listData.models?.filter(m => m.supportedGenerationMethods?.includes('generateContent'));
        if (available && available.length > 0) {
          // Prefer gemini-1.5-flash or gemini-2.0-flash, otherwise take the first one
          const preferred = available.find(m => m.name.includes('flash')) || available[0];
          // m.name includes 'models/' prefix, e.g. "models/gemini-1.5-flash"
          _model = { version: 'v1beta', name: preferred.name.replace('models/', '') };
          console.info(`[Gemini] ✅ Auto-discovered model: ${_model.name}`);
        }
      }
    } catch (err) {
      console.warn('Auto-discovery failed, falling back to hardcoded models.', err);
    }
  }

  const targetsToTry = modelOverride ? [modelOverride] : (_model ? [_model] : MODELS);

  for (const target of targetsToTry) {
    const url = `${BASE_URL}/${target.version}/models/${target.name}:generateContent?key=${API_KEY}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, topP: 0.8, maxOutputTokens: 2048 },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        lastErrorMsg = err?.error?.message ?? `HTTP ${res.status}`;
        console.warn(`[Gemini] ${target.version}/${target.name} failed:`, lastErrorMsg);
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastErrorMsg = "No text returned from Gemini API";
        continue;
      }

      // Cache the working model if hardcoded list was used
      if (!_model) {
        _model = target;
      }
      return text;

    } catch (err) {
      lastErrorMsg = err.message;
      console.warn(`[Gemini] ${target.version}/${target.name} error:`, err.message);
    }
  }

  throw new Error(`API Key valid, but generation failed. Details: ${lastErrorMsg || 'Unknown error.'}`);
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
      status:               'completed',
      processed_at:         new Date().toISOString(),
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
