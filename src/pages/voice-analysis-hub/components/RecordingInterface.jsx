import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RecordingInterface = ({ onRecordingComplete }) => {
  const [isRecording,   setIsRecording]   = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel,    setAudioLevel]    = useState(0);
  const [isPaused,      setIsPaused]      = useState(false);
  // Preview state — after stopping, before confirming
  const [previewBlob,   setPreviewBlob]   = useState(null);
  const [previewName,   setPreviewName]   = useState('');
  const [previewTime,   setPreviewTime]   = useState(0);

  const timerRef         = useRef(null);
  const audioContextRef  = useRef(null);
  const analyserRef      = useRef(null);
  const animationRef     = useRef(null);
  const streamRef        = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const mimeTypeRef      = useRef('audio/webm');
  const startTimeRef     = useRef(0);    // wall-clock ms when recording started
  const pausedTimeRef    = useRef(0);    // total ms paused (for accurate duration)
  const pauseStartRef    = useRef(null); // when current pause began

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(animationRef.current);
      audioContextRef.current?.close();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      setPreviewBlob(null);

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current     = audioContextRef.current.createAnalyser();
      audioContextRef.current.createMediaStreamSource(stream).connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      mimeTypeRef.current = mimeType;

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // onstop — calculate duration from wall clock (never stale)
      recorder.onstop = () => {
        const elapsed  = Math.round((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
        const blob     = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        const fileName = `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        setPreviewBlob(blob);
        setPreviewName(fileName);
        setPreviewTime(elapsed);
      };

      recorder.start(1000);
      startTimeRef.current  = Date.now();
      pausedTimeRef.current = 0;
      pauseStartRef.current = null;
      setIsRecording(true);
      setRecordingTime(0);
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        const elapsed = Math.round((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
        setRecordingTime(elapsed);
      }, 1000);
      updateAudioLevel();

    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('لم يتمكن التطبيق من الوصول إلى الميكروفون. يرجى السماح بالوصول في إعدادات المتصفح.');
    }
  };

  const updateAudioLevel = () => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b) / data.length;
    setAudioLevel(Math.min(100, (avg / 255) * 100 * 3));
    animationRef.current = requestAnimationFrame(updateAudioLevel);
  };

  const pauseRecording = () => {
    mediaRecorderRef.current?.pause();
    pauseStartRef.current = Date.now(); // remember when we paused
    setIsPaused(true);
    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
  };

  const resumeRecording = () => {
    // Accumulate the paused duration
    if (pauseStartRef.current) {
      pausedTimeRef.current += Date.now() - pauseStartRef.current;
      pauseStartRef.current = null;
    }
    mediaRecorderRef.current?.resume();
    setIsPaused(false);
    timerRef.current = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTimeRef.current - pausedTimeRef.current) / 1000);
      setRecordingTime(elapsed);
    }, 1000);
    updateAudioLevel();
  };

  // Stop recording → go to preview (confirm/cancel)
  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    mediaRecorderRef.current?.stop(); // triggers onstop → sets previewBlob
    setAudioLevel(0);
  };

  // Cancel during recording — discard everything
  const cancelRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    // Mark as cancelled so onstop discards the blob
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {}; // Override to do nothing
      mediaRecorderRef.current.stop();
    }
    setRecordingTime(0);
    setAudioLevel(0);
    chunksRef.current = [];
  };

  // Confirm preview → send to parent pipeline
  const confirmRecording = () => {
    if (!previewBlob) return;
    onRecordingComplete({
      audioBlob:     previewBlob,
      fileName:      previewName,
      fileSizeBytes: previewBlob.size,
      duration:      previewTime,
    });
    setPreviewBlob(null);
    setPreviewName('');
    setPreviewTime(0);
  };

  // Discard preview → back to idle
  const discardRecording = () => {
    setPreviewBlob(null);
    setPreviewName('');
    setPreviewTime(0);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
          <Icon name="Mic" size={20} color="var(--color-primary)" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Voice Recording</h2>
          <p className="text-sm text-muted-foreground">Record customer conversations for AI analysis</p>
        </div>
      </div>

      <div className="flex flex-col items-center py-8">

        {/* ── Preview state (after stop, before confirm) ── */}
        {previewBlob && !isRecording && (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="w-full p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-4">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon name="CheckCircle2" size={22} color="#10b981" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{previewName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatTime(previewTime)} &nbsp;•&nbsp; {formatSize(previewBlob.size)}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">هل تريد تحليل هذا التسجيل؟</p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline" size="sm"
                iconName="Trash2" iconPosition="left"
                onClick={discardRecording}
              >
                إلغاء
              </Button>
              <Button
                variant="default" size="sm"
                iconName="Sparkles" iconPosition="left"
                onClick={confirmRecording}
              >
                تحليل التسجيل
              </Button>
            </div>
          </div>
        )}

        {/* ── Recording state ── */}
        {isRecording && (
          <>
            <div className="relative mb-6">
              <button
                disabled={isPaused}
                className="relative w-32 h-32 rounded-full bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/50 animate-pulse disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Recording in progress"
              >
                <Icon
                  name="Mic"
                  size={48}
                  color="white"
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                />
              </button>
              {/* Audio level bar */}
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-40 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-100" style={{ width: `${audioLevel}%` }} />
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                <span className="text-2xl font-mono font-semibold text-foreground">
                  {formatTime(recordingTime)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Cancel — discard entirely */}
                <Button
                  variant="ghost" size="sm"
                  iconName="X" iconPosition="left"
                  onClick={cancelRecording}
                >
                  إلغاء
                </Button>
                {/* Pause / Resume */}
                <Button
                  variant="outline" size="sm"
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  iconName={isPaused ? 'Play' : 'Pause'} iconPosition="left"
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                {/* Stop → go to preview */}
                <Button
                  variant="destructive" size="sm"
                  onClick={stopRecording}
                  iconName="Square" iconPosition="left"
                >
                  Stop
                </Button>
              </div>

              <div className="w-full mt-2 p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Audio Level</span>
                  <span className="font-medium text-foreground">{Math.round(audioLevel)}%</span>
                </div>
                <div className="mt-2 h-1 bg-background rounded-full overflow-hidden">
                  <div className="h-full bg-success transition-all duration-100" style={{ width: `${audioLevel}%` }} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── Idle state ── */}
        {!isRecording && !previewBlob && (
          <>
            <div className="relative mb-6">
              <button
                onClick={startRecording}
                className="relative w-32 h-32 rounded-full bg-primary hover:bg-primary/90 shadow-lg shadow-primary/50 transition-all duration-300"
                aria-label="Start recording"
              >
                <Icon
                  name="Mic"
                  size={48}
                  color="white"
                  className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
                />
              </button>
            </div>
            <div className="text-center mt-4">
              <p className="text-sm text-muted-foreground">Click the microphone to start recording</p>
              <p className="text-xs text-muted-foreground mt-1">Supports Arabic &amp; English • Max 30 minutes</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RecordingInterface;