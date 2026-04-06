import React, { useState, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const SUPPORTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg'];
const SUPPORTED_EXT   = '.mp3,.wav,.m4a,.webm,.ogg,.mp4';
const MAX_SIZE        = 20 * 1024 * 1024; // 20MB

const formatSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const FileUploadZone = ({ onFilesAdded, className = '' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]); // files waiting for confirm
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true);  };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver  = (e) => { e.preventDefault(); e.stopPropagation(); };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    collectFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileSelect = (e) => {
    collectFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  // Validate and add to pending list (does NOT call onFilesAdded yet)
  const collectFiles = (files) => {
    const valid = [];
    files.forEach(file => {
      const isAudio = SUPPORTED_TYPES.includes(file.type) || file.name.match(/\.(mp3|wav|m4a|webm|ogg|mp4)$/i);
      if (!isAudio) {
        alert(`الصيغة غير مدعومة: ${file.name}\nالصيغ المدعومة: MP3, WAV, M4A, WebM, OGG`);
        return;
      }
      if (file.size > MAX_SIZE) {
        alert(`الملف كبير جداً: ${file.name}\nالحد الأقصى هو 20MB للتوافق مع Gemini AI.`);
        return;
      }
      valid.push(file);
    });
    if (valid.length > 0) {
      setPendingFiles(prev => [...prev, ...valid]);
    }
  };

  // Confirm — send all pending files to parent pipeline
  const confirmUpload = () => {
    pendingFiles.forEach(file => {
      onFilesAdded({
        audioBlob:     file,
        fileName:      file.name,
        fileSizeBytes: file.size,
        fileType:      file.type,
      });
    });
    setPendingFiles([]);
  };

  // Cancel — discard all pending
  const cancelUpload = () => setPendingFiles([]);

  // Remove a single pending file
  const removeFile = (idx) => setPendingFiles(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className={`bg-card rounded-lg border border-border p-6 flex flex-col gap-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 bg-secondary/10 rounded-lg">
          <Icon name="Upload" size={20} color="var(--color-secondary)" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">File Upload</h2>
          <p className="text-sm text-muted-foreground">Upload audio for AI transcription &amp; analysis</p>
        </div>
      </div>

      {/* Drop Zone — always visible */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 transition-all duration-200 cursor-pointer
          ${isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={SUPPORTED_EXT}
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${isDragging ? 'bg-primary/20' : 'bg-muted'}`}>
            <Icon name="FileAudio" size={32} color={isDragging ? 'var(--color-primary)' : 'var(--color-muted-foreground)'} />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">
            {isDragging ? '🎵 أفلت الملف هنا' : 'اسحب وأفلت الملفات الصوتية'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">أو انقر للاختيار من جهازك</p>

          <Button variant="outline" iconName="FolderOpen" iconPosition="left">
            Browse Files
          </Button>

          <div className="mt-5 pt-5 border-t border-border w-full grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Icon name="HardDrive" size={13} />
              <span>الحد الأقصى 20MB</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Icon name="Music" size={13} />
              <span>MP3, WAV, M4A, WebM</span>
            </div>
            <div className="flex items-center gap-1.5 col-span-2">
              <Icon name="Sparkles" size={13} className="text-primary" />
              <span className="text-primary">Gemini AI سيحوّل الصوت لنص تلقائياً</span>
            </div>
          </div>
        </div>
      </div>

      {/* Pending files preview */}
      {pendingFiles.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            الملفات المختارة ({pendingFiles.length})
          </p>

          <div className="space-y-2">
            {pendingFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
                <Icon name="FileAudio" size={18} color="var(--color-primary)" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                  className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name="X" size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Confirm / Cancel */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline" size="sm"
              iconName="Trash2" iconPosition="left"
              onClick={cancelUpload}
              className="flex-1"
            >
              إلغاء
            </Button>
            <Button
              variant="default" size="sm"
              iconName="Sparkles" iconPosition="left"
              onClick={confirmUpload}
              className="flex-1"
            >
              تحليل {pendingFiles.length > 1 ? `(${pendingFiles.length})` : ''}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadZone;