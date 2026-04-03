import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import RecordingInterface from './components/RecordingInterface';
import FileUploadZone from './components/FileUploadZone';
import ProcessingQueue from './components/ProcessingQueue';
import RecentAnalysis from './components/RecentAnalysis';
import { useAuth } from '../../contexts/AuthContext';
import {
  fetchRecentAnalyses,
  fetchProcessingQueue,
  enqueueFile,
  updateQueueProgress,
} from '../../services/voiceAnalysisService';

const VoiceAnalysisHub = () => {
  const { user } = useAuth();
  const [queueItems,          setQueueItems]          = useState([]);
  const [completedAnalyses,   setCompletedAnalyses]   = useState([]);
  const [loading,             setLoading]             = useState(true);
  const [error,               setError]               = useState(null);

  // Load data on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchRecentAnalyses(10),
      fetchProcessingQueue(user?.id),
    ])
      .then(([analyses, queue]) => {
        if (cancelled) return;
        setCompletedAnalyses(analyses);
        setQueueItems(queue);
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleRecordingComplete = async (recording) => {
    try {
      const newItem = await enqueueFile({
        fileName:      recording.fileName ?? `recording_${Date.now()}.webm`,
        fileFormat:    'webm',
        fileSizeBytes: recording.fileSizeBytes,
        source:        'recording',
        submittedBy:   user?.id,
      });
      setQueueItems(prev => [{ ...newItem, progress_pct: 0 }, ...prev]);
    } catch {
      // Falls back to local state on error
      setQueueItems(prev => [{ ...recording, progress: 0, status: 'processing' }, ...prev]);
    }
  };

  const handleFilesAdded = async (file) => {
    try {
      const ext = file.fileName?.split('.').pop()?.toLowerCase() ?? 'mp3';
      const newItem = await enqueueFile({
        fileName:      file.fileName,
        fileFormat:    ext,
        fileSizeBytes: file.fileSizeBytes,
        source:        'upload',
        submittedBy:   user?.id,
      });
      setQueueItems(prev => [{ ...newItem, progress_pct: 0 }, ...prev]);
    } catch {
      setQueueItems(prev => [{ ...file, progress: 0, status: 'processing' }, ...prev]);
    }
  };

  const handleItemComplete = async (completedItem) => {
    // Update progress in DB
    try {
      if (completedItem.id) {
        await updateQueueProgress(completedItem.id, 100, 'completed');
      }
    } catch { /* silent */ }

    setQueueItems(prev => prev.map(item =>
      (item.id ?? item.fileName) === (completedItem.id ?? completedItem.fileName)
        ? { ...item, status: 'completed', progress_pct: 100 }
        : item
    ));

    const analysis = {
      id:             completedItem.id,
      fileName:       completedItem.file_name ?? completedItem.fileName,
      sentiment:      completedItem.sentiment ?? 'Pending',
      sentimentScore: completedItem.sentiment_score ?? 0,
      completedAt:    new Date(),
      duration:       completedItem.duration_seconds
        ? `${Math.floor(completedItem.duration_seconds / 60)}:${String(completedItem.duration_seconds % 60).padStart(2, '0')}`
        : '0:00',
      confidence:     completedItem.sentiment_confidence ?? 0,
      transcript:     'Transcript will be available after AI processing completes.',
    };

    setCompletedAnalyses(prev => [analysis, ...prev]);
  };

  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen bg-background">
        <div className="container mx-auto p-6">
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Voice Analysis Hub</h1>
              <p className="text-muted-foreground">Record conversations or upload audio files for AI-powered sentiment analysis</p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              {loading && <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>}
              {error   && <span className="text-xs text-destructive">⚠ {error}</span>}
            </div>
          </div>

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