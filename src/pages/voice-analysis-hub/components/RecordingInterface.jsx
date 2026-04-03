import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RecordingInterface = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null); // ← keep track of MediaStream to stop it properly

  useEffect(() => {
    return () => {
      if (timerRef?.current) clearInterval(timerRef?.current);
      if (animationRef?.current) cancelAnimationFrame(animationRef?.current);
      if (audioContextRef?.current) audioContextRef?.current?.close();
      // Stop microphone track so browser recording indicator disappears
      if (streamRef?.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices?.getUserMedia({ audio: true });
      streamRef.current = stream; // ← save stream reference
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef?.current?.createAnalyser();
      const source = audioContextRef?.current?.createMediaStreamSource(stream);
      source?.connect(analyserRef?.current);
      analyserRef.current.fftSize = 256;

      setIsRecording(true);
      setRecordingTime(0);
      setIsPaused(false);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      updateAudioLevel();
    } catch (error) {
      console.error('Microphone access denied:', error);
    }
  };

  const updateAudioLevel = () => {
    if (!analyserRef?.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef?.current?.getByteFrequencyData(dataArray);
    const average = dataArray?.reduce((a, b) => a + b) / dataArray?.length;
    setAudioLevel(Math.min(100, (average / 255) * 100));

    animationRef.current = requestAnimationFrame(updateAudioLevel);
  };

  const pauseRecording = () => {
    setIsPaused(true);
    if (timerRef?.current) clearInterval(timerRef?.current);
    if (animationRef?.current) cancelAnimationFrame(animationRef?.current);
  };

  const resumeRecording = () => {
    setIsPaused(false);
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
    updateAudioLevel();
  };

  const stopRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    if (timerRef?.current) clearInterval(timerRef?.current);
    if (animationRef?.current) cancelAnimationFrame(animationRef?.current);
    if (audioContextRef?.current) audioContextRef?.current?.close();
    // ← Stop the microphone so browser recording indicator disappears
    if (streamRef?.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    const mockRecording = {
      id: `rec_${Date.now()}`,
      fileName: `recording_${new Date()?.toISOString()?.slice(0, 10)}_${recordingTime}s.wav`,
      duration: recordingTime,
      timestamp: new Date(),
      status: 'processing'
    };

    onRecordingComplete(mockRecording);
    setRecordingTime(0);
    setAudioLevel(0);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins?.toString()?.padStart(2, '0')}:${secs?.toString()?.padStart(2, '0')}`;
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
          <Icon name="Mic" size={20} color="var(--color-primary)" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Voice Recording</h2>
          <p className="text-sm text-muted-foreground">Record customer conversations for analysis</p>
        </div>
      </div>

      <div className="flex flex-col items-center py-8">
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
                variant="outline"
                size="sm"
                onClick={isPaused ? resumeRecording : pauseRecording}
                iconName={isPaused ? 'Play' : 'Pause'}
                iconPosition="left"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={stopRecording}
                iconName="Square"
                iconPosition="left"
              >
                Stop Recording
              </Button>
            </div>

            <div className="w-full mt-4 p-4 bg-muted/50 rounded-lg">
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
              Max duration: 30 minutes
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordingInterface;