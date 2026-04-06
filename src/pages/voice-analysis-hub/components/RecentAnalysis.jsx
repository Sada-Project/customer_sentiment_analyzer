import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

// ── Audio Player Modal ────────────────────────────────────────────────────────
const AudioPlayerModal = ({ analysis, onClose }) => {
  const audioRef   = useRef(null);
  const [playing,  setPlaying]  = useState(false);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime  = () => setCurrent(el.currentTime);
    const onLoad  = () => setDuration(el.duration);
    const onEnd   = () => setPlaying(false);
    el.addEventListener('timeupdate',  onTime);
    el.addEventListener('loadedmetadata', onLoad);
    el.addEventListener('ended',       onEnd);
    return () => {
      el.removeEventListener('timeupdate',     onTime);
      el.removeEventListener('loadedmetadata', onLoad);
      el.removeEventListener('ended',          onEnd);
    };
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else         { el.play();  setPlaying(true);  }
  };

  const seek = (e) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    el.currentTime = ratio * duration;
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2,'0')}`;
  };

  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        {/* Hidden native audio */}
        <audio ref={audioRef} src={analysis.audioUrl} preload="metadata" />

        {/* File name */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="Music" size={20} color="var(--color-primary)" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">{analysis.fileName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{analysis.sentiment} · {analysis.sentimentScore}%</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div
          className="h-2 bg-muted rounded-full overflow-hidden cursor-pointer mb-3"
          onClick={seek}
        >
          <div
            className="h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Time */}
        <div className="flex justify-between text-xs text-muted-foreground mb-4">
          <span>{fmt(current)}</span>
          <span>{fmt(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => { const el = audioRef.current; if (el) el.currentTime = Math.max(0, el.currentTime - 10); }}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <Icon name="SkipBack" size={20} />
          </button>

          <button
            onClick={toggle}
            className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center shadow-lg shadow-primary/30 transition-all"
          >
            <Icon name={playing ? 'Pause' : 'Play'} size={26} color="white" />
          </button>

          <button
            onClick={() => { const el = audioRef.current; if (el) el.currentTime = Math.min(duration, el.currentTime + 10); }}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <Icon name="SkipForward" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Transcript Modal ──────────────────────────────────────────────────────────
const TranscriptModal = ({ analysis, onClose }) => {
  const [copied, setCopied] = useState(false);

  const copyTranscript = async () => {
    await navigator.clipboard.writeText(analysis.transcript ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="FileText" size={18} color="var(--color-primary)" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm truncate max-w-xs">
                {analysis.fileName}
              </h3>
              <p className="text-xs text-muted-foreground">Full Transcript</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="xs"
              iconName={copied ? 'Check' : 'Copy'}
              iconPosition="left"
              onClick={copyTranscript}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-muted rounded-lg transition-colors"
            >
              <Icon name="X" size={18} />
            </button>
          </div>
        </div>

        {/* Transcript body */}
        <div className="flex-1 overflow-y-auto p-5">
          {analysis.transcript ? (
            <p
              className="text-sm text-foreground leading-relaxed whitespace-pre-wrap"
              dir="auto"
            >
              {analysis.transcript}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic text-center py-8">
              لا يوجد نص متاح لهذا التسجيل.
            </p>
          )}
        </div>

        {/* AI Summary (if available) */}
        {analysis.aiSummary && (
          <div className="p-5 border-t border-border bg-blue-500/5">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">
              AI Summary
            </p>
            <p className="text-sm text-foreground leading-relaxed">{analysis.aiSummary}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const RecentAnalysis = ({ analyses = [] }) => {
  const navigate = useNavigate();
  const [activeTranscript, setActiveTranscript] = useState(null);
  const [activePlayer,     setActivePlayer]     = useState(null); // for audio playback
  const [sharedId,         setSharedId]         = useState(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const getSentimentConfig = (score, sentimentLabel) => {
    const label = sentimentLabel?.toLowerCase();
    if (label === 'satisfied' || score >= 70)
      return { label: 'Satisfied', color: 'text-emerald-400 bg-emerald-500/10' };
    if (label === 'neutral' || score >= 50)
      return { label: 'Neutral',   color: 'text-slate-400 bg-slate-500/10'   };
    if (label === 'frustrated' || score >= 30)
      return { label: 'Frustrated',color: 'text-amber-400 bg-amber-500/10'   };
    return   { label: 'Angry',     color: 'text-rose-400 bg-rose-500/10'     };
  };

  const formatDate = (date) => {
    const diff = Math.floor((Date.now() - new Date(date)) / 1000);
    if (diff < 60)    return 'Just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ── Button Handlers ─────────────────────────────────────────────────────────
  const handleShare = async (analysis) => {
    const text = [
      `📞 Call Analysis: ${analysis.fileName}`,
      `📊 Sentiment: ${analysis.sentiment ?? '-'} (${analysis.sentimentScore ?? 0}%)`,
      `🤖 AI Summary: ${analysis.aiSummary ?? 'N/A'}`,
      `✅ Confidence: ${analysis.confidence ?? 0}%`,
    ].join('\n');

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Call Analysis', text });
      } else {
        await navigator.clipboard.writeText(text);
        setSharedId(analysis.id);
        setTimeout(() => setSharedId(null), 2500);
      }
    } catch { /* user cancelled */ }
  };

  const handlePlay = (analysis) => {
    if (analysis.audioUrl) {
      setActivePlayer(analysis);
    } else {
      alert(`🎵 ${analysis.fileName}\n\nالملف الصوتي غير محفوظ في هذا السجل.\n\nيمكن تشغيل الملفات المرفوعة حديثاً فقط.`);
    }
  };

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (analyses.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 h-full flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <Icon name="History" size={32} color="var(--color-muted-foreground)" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No recent analysis</h3>
        <p className="text-sm text-muted-foreground">
          Upload or record audio to see results here
        </p>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="bg-card rounded-lg border border-border h-full flex flex-col w-full">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-success/10 rounded-lg">
                <Icon name="History" size={20} color="var(--color-success)" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Recent Analysis</h2>
                <p className="text-sm text-muted-foreground">Last {analyses.length} completed</p>
              </div>
            </div>

            {/* ✅ View All — navigates to call recordings page */}
            <Button
              variant="ghost" size="sm"
              iconName="ExternalLink" iconPosition="right"
              onClick={() => navigate('/call-recordings')}
            >
              View All
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="divide-y divide-border overflow-y-auto flex-1">
          {analyses.map((analysis) => {
            const cfg = getSentimentConfig(analysis.sentimentScore, analysis.sentiment);
            return (
              <div
                key={analysis.id}
                className="p-5 hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg flex-shrink-0 mt-0.5">
                    <Icon name="FileAudio" size={20} color="var(--color-primary)" />
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* File name + sentiment badge */}
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <h3 className="text-sm font-medium text-foreground truncate">
                        {analysis.fileName}
                      </h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Date + score */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span>{formatDate(analysis.completedAt)}</span>
                      <span className="text-foreground font-medium">{analysis.sentimentScore}%</span>
                    </div>

                    {/* Transcript snippet */}
                    {analysis.transcript && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed" dir="auto">
                        {analysis.transcript}
                      </p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Icon name="Clock" size={12} />
                        {analysis.duration ?? '0:00'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="Zap" size={12} />
                        {analysis.confidence ?? 0}% confidence
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      {/* ▶ Play */}
                      <Button
                        variant="outline" size="xs"
                        iconName="Play" iconPosition="left"
                        onClick={() => handlePlay(analysis)}
                      >
                        Play
                      </Button>

                      {/* 📄 Transcript */}
                      <Button
                        variant="outline" size="xs"
                        iconName="FileText" iconPosition="left"
                        onClick={() => setActiveTranscript(analysis)}
                        disabled={!analysis.transcript}
                      >
                        Transcript
                      </Button>

                      {/* 🔗 Share */}
                      <Button
                        variant="ghost" size="xs"
                        iconName={sharedId === analysis.id ? 'Check' : 'Share2'}
                        iconPosition="left"
                        onClick={() => handleShare(analysis)}
                      >
                        {sharedId === analysis.id ? 'Copied!' : 'Share'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Audio Player Modal */}
      {activePlayer && (
        <AudioPlayerModal
          analysis={activePlayer}
          onClose={() => setActivePlayer(null)}
        />
      )}

      {/* Transcript Modal */}
      {activeTranscript && (
        <TranscriptModal
          analysis={activeTranscript}
          onClose={() => setActiveTranscript(null)}
        />
      )}
    </>
  );
};

export default RecentAnalysis;