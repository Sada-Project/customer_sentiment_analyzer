import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Header from '../../components/ui/Header';
import { fetchRecentAnalyses, deleteRecordings } from '../../services/voiceAnalysisService';

// ── Audio Player Modal ────────────────────────────────────────────────────────
const AudioPlayerModal = ({ analysis, onClose }) => {
  const audioRef   = useRef(null);
  const [playing,  setPlaying]  = useState(false);
  const [current,  setCurrent]  = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrent(el.currentTime);
    const onLoad = () => setDuration(el.duration);
    const onEnd  = () => setPlaying(false);
    el.addEventListener('timeupdate',     onTime);
    el.addEventListener('loadedmetadata', onLoad);
    el.addEventListener('ended',          onEnd);
    return () => {
      el.removeEventListener('timeupdate',     onTime);
      el.removeEventListener('loadedmetadata', onLoad);
      el.removeEventListener('ended',          onEnd);
    };
  }, []);

  const toggle = () => { const el = audioRef.current; if (!el) return; playing ? el.pause() : el.play(); setPlaying(!playing); };
  const seek   = (e) => { const el = audioRef.current; if (!el || !duration) return; const rect = e.currentTarget.getBoundingClientRect(); el.currentTime = ((e.clientX - rect.left) / rect.width) * duration; };
  const fmt    = (s) => { if (!s || isNaN(s)) return '0:00'; return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <audio ref={audioRef} src={analysis.audioUrl} preload="metadata" />
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="Music" size={20} color="var(--color-primary)" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground text-sm truncate">{analysis.fileName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{analysis.sentiment} · {analysis.sentimentScore}%</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><Icon name="X" size={18} /></button>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden cursor-pointer mb-3" onClick={seek}>
          <div className="h-full bg-primary rounded-full transition-all duration-100" style={{ width: `${duration ? (current / duration) * 100 : 0}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mb-4"><span>{fmt(current)}</span><span>{fmt(duration)}</span></div>
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => { const el = audioRef.current; if (el) el.currentTime = Math.max(0, el.currentTime - 10); }} className="p-2 hover:bg-muted rounded-full"><Icon name="SkipBack" size={20} /></button>
          <button onClick={toggle} className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center shadow-lg shadow-primary/30"><Icon name={playing ? 'Pause' : 'Play'} size={26} color="white" /></button>
          <button onClick={() => { const el = audioRef.current; if (el) el.currentTime = Math.min(duration, el.currentTime + 10); }} className="p-2 hover:bg-muted rounded-full"><Icon name="SkipForward" size={20} /></button>
        </div>
      </div>
    </div>
  );
};

// ── Transcript Modal ──────────────────────────────────────────────────────────
const TranscriptModal = ({ analysis, onClose }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const el = document.createElement('textarea');
    el.value = analysis.transcript ?? '';
    el.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center"><Icon name="FileText" size={18} color="var(--color-primary)" /></div>
            <div>
              <h3 className="font-semibold text-foreground text-sm truncate max-w-xs">{analysis.fileName}</h3>
              <p className="text-xs text-muted-foreground">Full Transcript</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="xs" iconName={copied ? 'Check' : 'Copy'} onClick={copy}>{copied ? 'Copied!' : 'Copy'}</Button>
            <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><Icon name="X" size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {analysis.transcript
            ? <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap" dir="auto">{analysis.transcript}</p>
            : <p className="text-sm text-muted-foreground italic text-center py-8">No transcript available.</p>}
        </div>
        {analysis.aiSummary && (
          <div className="p-5 border-t border-border bg-blue-500/5">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">AI Summary</p>
            <p className="text-sm text-foreground leading-relaxed">{analysis.aiSummary}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Delete Confirm Dialog ─────────────────────────────────────────────────────
const DeleteConfirmDialog = ({ count, onConfirm, onCancel, loading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
    <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
      <div className="w-14 h-14 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <Icon name="Trash2" size={28} color="#f43f5e" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">حذف {count} تسجيل؟</h3>
      <p className="text-sm text-muted-foreground mb-6">
        سيتم حذف التسجيلات المحددة والملفات الصوتية نهائياً. لا يمكن التراجع عن هذا الإجراء.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>إلغاء</Button>
        <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={loading} iconName={loading ? 'Loader2' : 'Trash2'} iconPosition="left">
          {loading ? 'جارٍ الحذف…' : 'حذف'}
        </Button>
      </div>
    </div>
  </div>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
const getSentimentConfig = (score, label) => {
  const l = label?.toLowerCase();
  if (l === 'satisfied' || score >= 70) return { label: 'Satisfied', color: 'text-emerald-400 bg-emerald-500/10' };
  if (l === 'neutral'   || score >= 50) return { label: 'Neutral',   color: 'text-slate-400 bg-slate-500/10'   };
  if (l === 'frustrated'|| score >= 30) return { label: 'Frustrated',color: 'text-amber-400 bg-amber-500/10'   };
  return                                       { label: 'Angry',     color: 'text-rose-400 bg-rose-500/10'     };
};

const formatDate = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const CallRecordings = () => {
  const navigate = useNavigate();
  const [analyses,  setAnalyses]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [sentiment, setSentiment] = useState('all');

  // Selection state
  const [selectMode,   setSelectMode]   = useState(false);
  const [selected,     setSelected]     = useState(new Set());
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [deleting,     setDeleting]     = useState(false);

  const [activePlayer,     setActivePlayer]     = useState(null);
  const [activeTranscript, setActiveTranscript] = useState(null);
  const [sharedId,         setSharedId]         = useState(null);

  useEffect(() => {
    fetchRecentAnalyses(100)
      .then(data => setAnalyses(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Selection helpers ────────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(a => a.id)));
    }
  };

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  // ── Delete handler ───────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteRecordings([...selected]);
      setAnalyses(prev => prev.filter(a => !selected.has(a.id)));
      setSelected(new Set());
      setShowConfirm(false);
      setSelectMode(false);
    } catch (err) {
      alert(`خطأ في الحذف: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleShare = async (a) => {
    const text = [`📞 ${a.fileName}`, `📊 Sentiment: ${a.sentiment} (${a.sentimentScore}%)`, `🤖 Summary: ${a.aiSummary ?? 'N/A'}`].join('\n');
    try {
      if (navigator.share) { await navigator.share({ title: 'Call Analysis', text }); }
      else {
        const el = document.createElement('textarea');
        el.value = text; el.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
        setSharedId(a.id); setTimeout(() => setSharedId(null), 2000);
      }
    } catch {}
  };

  const filtered = analyses.filter(a => {
    const matchSearch    = !search    || a.fileName?.toLowerCase().includes(search.toLowerCase());
    const matchSentiment = sentiment === 'all' || a.sentiment?.toLowerCase() === sentiment;
    return matchSearch && matchSentiment;
  });

  const SENTIMENTS = ['all', 'satisfied', 'neutral', 'frustrated', 'angry'];
  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

          {/* Page title */}
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => navigate('/voice-analysis-hub')} className="p-2 hover:bg-muted rounded-lg transition-colors">
              <Icon name="ArrowLeft" size={20} />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">All Call Recordings</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {loading ? 'Loading…' : `${filtered.length} of ${analyses.length} recordings`}
              </p>
            </div>

            {/* Select / Delete toolbar */}
            {!selectMode ? (
              <Button variant="outline" size="sm" iconName="CheckSquare" iconPosition="left" onClick={() => setSelectMode(true)}>
                تحديد
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{selected.size} محدد</span>
                <Button variant="ghost" size="sm" onClick={exitSelectMode}>إلغاء</Button>
                <Button
                  variant="destructive" size="sm"
                  iconName="Trash2" iconPosition="left"
                  disabled={selected.size === 0}
                  onClick={() => setShowConfirm(true)}
                >
                  حذف ({selected.size})
                </Button>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            {/* Select All checkbox (only in select mode) */}
            {selectMode && (
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium hover:border-primary/50 transition-colors"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${allSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                  {allSelected && <Icon name="Check" size={10} color="white" />}
                </div>
                تحديد الكل
              </button>
            )}

            {/* Search */}
            <div className="flex-1 min-w-[200px] relative">
              <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by file name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Sentiment filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {SENTIMENTS.map(s => (
                <button
                  key={s}
                  onClick={() => setSentiment(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-all ${
                    sentiment === s ? 'bg-primary text-white border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {s === 'all' ? 'All' : s}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground gap-3">
              <Icon name="Loader2" size={20} className="animate-spin" /><span>Loading recordings…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Icon name="FileAudio" size={28} color="var(--color-muted-foreground)" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">No recordings found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your filters or upload a new audio file</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/voice-analysis-hub')}>Go to Voice Analysis Hub</Button>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border divide-y divide-border">
              {filtered.map(a => {
                const cfg        = getSentimentConfig(a.sentimentScore, a.sentiment);
                const isSelected = selected.has(a.id);
                return (
                  <div
                    key={a.id}
                    className={`p-5 transition-colors ${selectMode ? 'cursor-pointer' : ''} ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/20'}`}
                    onClick={selectMode ? () => toggleSelect(a.id) : undefined}
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox (select mode) / Icon (normal mode) */}
                      {selectMode ? (
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-2.5 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
                          {isSelected && <Icon name="Check" size={12} color="white" />}
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon name="FileAudio" size={20} color="var(--color-primary)" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <h3 className="text-sm font-semibold text-foreground truncate">{a.fileName}</h3>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${cfg.color}`}>{cfg.label}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                          <span>{formatDate(a.completedAt)}</span>
                          <span className="flex items-center gap-1"><Icon name="Zap" size={11} />{a.confidence}% confidence</span>
                        </div>
                        {a.transcript && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3 leading-relaxed" dir="auto">{a.transcript}</p>
                        )}
                        {/* Actions — hidden in select mode */}
                        {!selectMode && (
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="xs" iconName="Play" iconPosition="left" onClick={() => a.audioUrl ? setActivePlayer(a) : alert('Audio not available.')} disabled={!a.audioUrl}>Play</Button>
                            <Button variant="outline" size="xs" iconName="FileText" iconPosition="left" onClick={() => setActiveTranscript(a)} disabled={!a.transcript}>Transcript</Button>
                            <Button variant="ghost" size="xs" iconName={sharedId === a.id ? 'Check' : 'Share2'} iconPosition="left" onClick={() => handleShare(a)}>
                              {sharedId === a.id ? 'Copied!' : 'Share'}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {activePlayer     && <AudioPlayerModal  analysis={activePlayer}     onClose={() => setActivePlayer(null)}     />}
      {activeTranscript && <TranscriptModal   analysis={activeTranscript} onClose={() => setActiveTranscript(null)} />}
      {showConfirm      && <DeleteConfirmDialog count={selected.size} loading={deleting} onConfirm={handleDelete} onCancel={() => setShowConfirm(false)} />}
    </>
  );
};

export default CallRecordings;
