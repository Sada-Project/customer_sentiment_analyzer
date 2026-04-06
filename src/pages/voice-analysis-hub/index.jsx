import React, { useState, useEffect, useCallback } from 'react';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import RecordingInterface from './components/RecordingInterface';
import FileUploadZone from './components/FileUploadZone';
import ProcessingQueue from './components/ProcessingQueue';
import RecentAnalysis from './components/RecentAnalysis';
import { useAuth } from '../../contexts/AuthContext';
import {
  transcribeAudio,
  analyzeCallFull,
  checkGeminiConnection,
} from '../../services/geminiService';
import {
  fetchRecentAnalyses,
  fetchProcessingQueue,
  enqueueFile,
  createCallRecord,
  uploadAudioToStorage,
  saveAudioUrl,
  updateQueueProgress,
} from '../../services/voiceAnalysisService';

// ─── Sentiment colour helpers ─────────────────────────────────────────────────
const SENTIMENT_STYLES = {
  satisfied: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: 'Smile' },
  neutral: { bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400', icon: 'Minus' },
  frustrated: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: 'Frown' },
  angry: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400', icon: 'AlertCircle' },
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const VoiceAnalysisHub = () => {
  const { user } = useAuth();

  const [queueItems, setQueueItems] = useState([]);
  const [completedAnalyses, setCompletedAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [geminiStatus, setGeminiStatus] = useState('checking'); // checking | online | offline
  const [activeJob, setActiveJob] = useState(null);
  /* activeJob shape:
     { fileName, step, progress, transcript, result, error } */

  // ── Initial data load ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchRecentAnalyses(10), fetchProcessingQueue(user?.id)])
      .then(([analyses, queue]) => {
        if (cancelled) return;
        setCompletedAnalyses(analyses);
        setQueueItems(queue);
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  // ── Gemini connection check ─────────────────────────────────────────────────
  useEffect(() => {
    checkGeminiConnection().then(r => setGeminiStatus(r.connected ? 'online' : 'offline'));
  }, []);

  // ── Core pipeline: Audio Blob → Transcript → Analysis → UI ─────────────────
  const processAudio = useCallback(async (audioBlob, fileName, dbId = null, audioUrl = null) => {
    if (!audioBlob) return;
    if (geminiStatus === 'offline') {
      setActiveJob({ fileName, step: '❌ Gemini غير متصل — تحقق من مفتاح الـ API', progress: 0, error: true });
      return;
    }

    setActiveJob({ fileName, step: 'جارٍ تحويل الصوت إلى نص…', progress: 5, transcript: null, result: null });

    try {
      // ── Step 1: Transcribe ─────────────────────────────────────────────────
      const sttResult = await transcribeAudio(audioBlob, (msg) =>
        setActiveJob(j => ({ ...j, step: msg }))
      );
      const transcript = sttResult.transcript;

      setActiveJob(j => ({
        ...j,
        transcript,
        step: `تم استخراج النص ✅ (${sttResult.word_count} كلمة) — جارٍ التحليل الشامل…`,
        progress: 40,
      }));

      // ── Step 2: Full analysis (sentiment + summary + topics + keywords) ────
      const result = await analyzeCallFull(
        { callId: dbId, transcript, customerName: 'Customer', agentName: user?.full_name ?? 'Agent' },
        (msg, pct) => setActiveJob(j => ({ ...j, step: msg, progress: pct ?? j.progress }))
      );

      setActiveJob(j => ({ ...j, result, step: 'اكتمل التحليل بنجاح ✅', progress: 100 }));

      // ── Step 3: Push to Recent Analyses list ───────────────────────────────
      const s = result.sentiment?.sentiment ?? 'neutral';
      setCompletedAnalyses(prev => [{
        id: dbId ?? `local_${Date.now()}`,
        fileName,
        sentiment: s,
        sentimentScore: result.sentiment?.sentiment_score ?? 50,
        completedAt: new Date(),
        duration: '0:00',
        confidence: result.sentiment?.sentiment_confidence ?? 0,
        transcript: transcript.slice(0, 500) + (transcript.length > 500 ? '…' : ''),
        aiSummary: result.summary?.summary,
        audioUrl: audioUrl ?? null,   // ← so Play works immediately
      }, ...prev]);

      // ── Step 4: Update DB queue status ────────────────────────────────────
      if (dbId) {
        setQueueItems(prev => prev.map(item =>
          item.id === dbId ? { ...item, status: 'completed', progress_pct: 100 } : item
        ));
        await updateQueueProgress(dbId, 100, 'completed').catch(() => { });
      }

    } catch (err) {
      console.error('[Voice Pipeline]', err);
      setActiveJob(j => ({ ...j, step: `❌ ${err.message}`, progress: 0, error: true }));
    }
  }, [geminiStatus, user?.full_name]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleRecordingComplete = async (recording) => {
    let callId = null;
    const ext = 'webm';

    // 1. Create call_recordings row
    try {
      callId = await createCallRecord({
        fileName: recording.fileName,
        fileFormat: ext,
        fileSizeBytes: recording.fileSizeBytes,
        submittedBy: user?.id,
      });
    } catch (e) { console.warn('createCallRecord failed:', e.message); }

    // 2. Upload audio to Supabase Storage
    let audioUrl = null;
    if (callId && recording.audioBlob) {
      try {
        audioUrl = await uploadAudioToStorage(recording.audioBlob, callId, recording.fileName);
        await saveAudioUrl(callId, audioUrl);
        console.info('[Audio] Uploaded to Storage:', audioUrl);
      } catch (e) {
        console.error('[Audio Upload Error]', e.message);
        setActiveJob(j => ({ ...j, step: `⚠️ تحذير: فشل رفع الصوت — ${e.message}`, progress: j.progress }));
      }
    }

    // 3. Add to processing_queue for UI
    try {
      const item = await enqueueFile({
        fileName: recording.fileName,
        fileFormat: ext,
        fileSizeBytes: recording.fileSizeBytes,
        source: 'recording',
        submittedBy: user?.id,
      });
      setQueueItems(prev => [{ ...item, progress_pct: 0 }, ...prev]);
    } catch {
      setQueueItems(prev => [{ fileName: recording.fileName, status: 'processing', progress_pct: 0 }, ...prev]);
    }

    processAudio(recording.audioBlob, recording.fileName, callId, audioUrl);
  };

  const handleFilesAdded = async (file) => {
    let callId = null;
    const ext = file.fileName?.split('.').pop()?.toLowerCase() ?? 'mp3';

    // 1. Create call_recordings row
    try {
      callId = await createCallRecord({
        fileName: file.fileName,
        fileFormat: ext,
        fileSizeBytes: file.fileSizeBytes,
        submittedBy: user?.id,
      });
    } catch (e) { console.warn('createCallRecord failed:', e.message); }

    // 2. Upload audio to Supabase Storage
    let audioUrl = null;
    if (callId && file.audioBlob) {
      try {
        audioUrl = await uploadAudioToStorage(file.audioBlob, callId, file.fileName);
        await saveAudioUrl(callId, audioUrl);
        console.info('[Audio] Uploaded to Storage:', audioUrl);
      } catch (e) {
        console.error('[Audio Upload Error]', e.message);
        setActiveJob(j => j ? { ...j, step: `⚠️ تحذير: فشل رفع الصوت — ${e.message}` } : j);
      }
    }

    // 3. Add to processing_queue for UI
    try {
      const item = await enqueueFile({
        fileName: file.fileName,
        fileFormat: ext,
        fileSizeBytes: file.fileSizeBytes,
        source: 'upload',
        submittedBy: user?.id,
      });
      setQueueItems(prev => [{ ...item, progress_pct: 0 }, ...prev]);
    } catch {
      setQueueItems(prev => [{ fileName: file.fileName, status: 'processing', progress_pct: 0 }, ...prev]);
    }

    processAudio(file.audioBlob, file.fileName, callId, audioUrl);
  };

  const handleItemComplete = async (completedItem) => {
    try {
      if (completedItem.id) await updateQueueProgress(completedItem.id, 100, 'completed');
    } catch { /* silent */ }
    setQueueItems(prev => prev.map(item =>
      (item.id ?? item.fileName) === (completedItem.id ?? completedItem.fileName)
        ? { ...item, status: 'completed', progress_pct: 100 }
        : item
    ));
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="container mx-auto p-6">

          {/* ── Page header ── */}
          <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">Voice Analysis Hub</h1>
              <p className="text-muted-foreground">Record or upload audio — Gemini AI will transcribe, summarise & analyse sentiment automatically</p>
            </div>

            {/* Gemini status pill */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${geminiStatus === 'checking' ? 'bg-muted border-border text-muted-foreground animate-pulse' :
                geminiStatus === 'online' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                  'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}>
              <div className={`w-2 h-2 rounded-full ${geminiStatus === 'online' ? 'bg-emerald-400 animate-pulse' :
                  geminiStatus === 'offline' ? 'bg-rose-400' : 'bg-slate-400'
                }`} />
              {geminiStatus === 'checking' ? 'Connecting to Gemini…' :
                geminiStatus === 'online' ? '✨ Gemini AI Ready' :
                  '⚠ Gemini Offline'}
              {loading && <Icon name="Loader2" size={14} className="animate-spin ml-1" />}
              {error && <span className="text-xs text-destructive ml-2">⚠ {error}</span>}
            </div>
          </div>

          {/* ── Active Job Panel ── */}
          {activeJob && (
            <div className={`mb-6 rounded-xl border p-5 transition-all ${activeJob.error ? 'bg-destructive/10 border-destructive/30' :
                activeJob.result ? 'bg-emerald-500/5 border-emerald-500/30' :
                  'bg-blue-500/5 border-blue-500/30'
              }`}>
              {/* Top row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Icon
                    name={activeJob.result ? 'CheckCircle2' : activeJob.error ? 'AlertCircle' : 'Loader2'}
                    size={22}
                    className={activeJob.result ? 'text-emerald-400' : activeJob.error ? 'text-destructive' : 'text-blue-400 animate-spin'}
                  />
                  <div>
                    <p className="font-semibold text-foreground">{activeJob.fileName}</p>
                    <p className="text-sm text-muted-foreground">{activeJob.step}</p>
                  </div>
                </div>
                {(activeJob.result || activeJob.error) && (
                  <button onClick={() => setActiveJob(null)} className="p-1.5 hover:bg-muted rounded-lg">
                    <Icon name="X" size={16} />
                  </button>
                )}
              </div>

              {/* Progress bar while processing */}
              {!activeJob.result && !activeJob.error && (
                <div className="h-1.5 bg-border rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all duration-500"
                    style={{ width: `${activeJob.progress || 10}%` }}
                  />
                </div>
              )}

              {/* Transcript box */}
              {activeJob.transcript && (
                <div className="p-4 bg-card/60 border border-border rounded-lg mb-3">
                  <span className="text-xs font-semibold text-primary uppercase tracking-wider block mb-2">
                    📄 Transcript
                  </span>
                  <p className="text-sm text-foreground leading-relaxed italic" dir="auto">
                    "{activeJob.transcript}"
                  </p>
                </div>
              )}

              {/* Result cards */}
              {activeJob.result && (() => {
                const s = activeJob.result.sentiment?.sentiment ?? 'neutral';
                const cfg = SENTIMENT_STYLES[s] ?? SENTIMENT_STYLES.neutral;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {/* Sentiment card */}
                    <div className={`p-4 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon name={cfg.icon} size={16} className={cfg.text} />
                        <span className={`text-sm font-semibold capitalize ${cfg.text}`}>{s}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          Score: <b className="text-foreground">{activeJob.result.sentiment?.sentiment_score}%</b>
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {Object.entries(activeJob.result.sentiment?.emotion_breakdown ?? {}).map(([emo, val]) => (
                          <div key={emo} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground w-16 capitalize">{emo}</span>
                            <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${emo === 'satisfied' ? 'bg-emerald-400' :
                                    emo === 'neutral' ? 'bg-slate-400' :
                                      emo === 'frustrated' ? 'bg-amber-400' : 'bg-rose-400'
                                  }`}
                                style={{ width: `${val}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-6 text-right">{val}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Summary card */}
                    <div className="p-4 rounded-lg border bg-blue-500/5 border-blue-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon name="FileText" size={16} className="text-blue-400" />
                        <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">AI Summary</span>
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${activeJob.result.summary?.resolution_status === 'resolved'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                          }`}>
                          {activeJob.result.summary?.resolution_status?.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">
                        {activeJob.result.summary?.summary}
                      </p>
                      {activeJob.result.summary?.key_points?.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {activeJob.result.summary.key_points.map((pt, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <Icon name="ChevronRight" size={12} className="mt-0.5 text-blue-400 flex-shrink-0" />
                              {pt}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Main Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 flex flex-col gap-6">
              <RecordingInterface onRecordingComplete={handleRecordingComplete} />
              <FileUploadZone onFilesAdded={handleFilesAdded} />
              {queueItems.length > 0 && (
                <ProcessingQueue items={queueItems} onItemComplete={handleItemComplete} />
              )}
            </div>
            <div className="lg:col-span-7 flex">
              <RecentAnalysis analyses={completedAnalyses} />
            </div>
          </div>

        </div>
      </main>
    </>
  );
};

export default VoiceAnalysisHub;