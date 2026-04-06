import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RecordingInterface = ({ onRecordingComplete }) => {
  const [isRecording,   setIsRecording]   = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel,    setAudioLevel]    = useState(0);
  const [isPaused,      setIsPaused]      = useState(false);

  const timerRef        = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef     = useRef(null);
  const animationRef    = useRef(null);
  const streamRef       = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);

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
      streamRef.current  = stream;
      chunksRef.current  = [];

      // Audio level monitor
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current     = audioContextRef.current.createAnalyser();
      audioContextRef.current.createMediaStreamSource(stream).connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      // Real recording via MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob     = new Blob(chunksRef.current, { type: mimeType });
        const fileName = `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
        onRecordingComplete({
          audioBlob:     blob,
          fileName,
          fileSizeBytes: blob.size,
          duration:      recordingTime,
        });
      };

      recorder.start(1000); // collect chunks every 1s
      setIsRecording(true);
      setRecordingTime(0);
      setIsPaused(false);

      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
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
    setIsPaused(true);
    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
  };

  const resumeRecording = () => {
    mediaRecorderRef.current?.resume();
    setIsPaused(false);
    timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    updateAudioLevel();
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());
    mediaRecorderRef.current?.stop(); // triggers onstop → onRecordingComplete
    setRecordingTime(0);
    setAudioLevel(0);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
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
        {/* Big record button */}
        <div className="relative mb-6">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isPaused}
            className={`
              relative w-32 h-32 rounded-full transition-all duration-300 ease-out
              ${isRecording
                ? 'bg-destructive hover:bg-destructive/90 shadow-lg shadow-destructive/50'
                : 'bg-primary hover:bg-primary/90 shadow-lg shadow-primary/50'
              }
              ${isRecording && !isPaused ? 'animate-pulse' : ''}
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <Icon
              name={isRecording ? 'Square' : 'Mic'}
              size={48}
              color="white"
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            />
          </button>

          {/* Audio level bar */}
          {isRecording && (
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-40 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-100"
                style={{ width: `${audioLevel}%` }}
              />
            </div>
          )}
        </div>

        {isRecording && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              <span className="text-2xl font-mono font-semibold text-foreground">
                {formatTime(recordingTime)}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline" size="sm"
                onClick={isPaused ? resumeRecording : pauseRecording}
                iconName={isPaused ? 'Play' : 'Pause'} iconPosition="left"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                variant="destructive" size="sm"
                onClick={stopRecording}
                iconName="Square" iconPosition="left"
              >
                Stop & Analyze
              </Button>
            </div>

            <div className="w-full mt-2 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Audio Level</span>
                <span className="font-medium text-foreground">{Math.round(audioLevel)}%</span>
              </div>
              <div className="mt-2 h-1 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-success transition-all duration-100"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {!isRecording && (
          <div className="text-center mt-4">
            <p className="text-sm text-muted-foreground">
              Click the microphone to start recording
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports Arabic & English • Max 30 minutes
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordingInterface;