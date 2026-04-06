import React, { useState, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const SUPPORTED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a', 'audio/webm', 'audio/ogg'];
const SUPPORTED_EXT   = '.mp3,.wav,.m4a,.webm,.ogg,.mp4';
const MAX_SIZE        = 20 * 1024 * 1024; // 20MB (Gemini inline limit)

const FileUploadZone = ({ onFilesAdded }) => {
  const [isDragging, setIsDragging]     = useState(false);
  const [localQueue,  setLocalQueue]    = useState([]); // { id, name, size, status }
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true);  };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver  = (e) => { e.preventDefault(); e.stopPropagation(); };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileSelect = (e) => {
    processFiles(Array.from(e.target.files));
    e.target.value = ''; // reset so the same file can be re-selected
  };

  const processFiles = (files) => {
    files.forEach(file => {
      // Validate type (be lenient — accept by extension too)
      const isAudio = SUPPORTED_TYPES.includes(file.type) || file.name.match(/\.(mp3|wav|m4a|webm|ogg|mp4)$/i);
      if (!isAudio) {
        alert(`الصيغة غير مدعومة: ${file.name}\nالصيغ المدعومة: MP3, WAV, M4A, WebM, OGG`);
        return;
      }
      if (file.size > MAX_SIZE) {
        alert(`الملف كبير جداً: ${file.name}\nالحد الأقصى هو 20MB للتوافق مع Gemini AI.`);
        return;
      }

      // Show in local queue immediately
      const id = `${file.name}_${Date.now()}`;
      setLocalQueue(q => [...q, { id, name: file.name, size: file.size, status: 'ready' }]);

      // Pass the REAL file blob to parent
      onFilesAdded({
        audioBlob:     file,           // ← real File object (extends Blob)
        fileName:      file.name,
        fileSizeBytes: file.size,
        fileType:      file.type,
        localId:       id,
      });
    });
  };

  const formatSize = (bytes) => {
    if (bytes < 1024)             return `${bytes} B`;
    if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-card rounded-lg border border-border p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 bg-secondary/10 rounded-lg">
          <Icon name="Upload" size={20} color="var(--color-secondary)" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">File Upload</h2>
          <p className="text-sm text-muted-foreground">Upload audio for AI transcription & analysis</p>
        </div>
      </div>

      {/* Drop Zone */}
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

      {/* Local queue (just for visual feedback) */}
      {localQueue.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">الملفات المضافة</h3>
          {localQueue.map(f => (
            <div key={f.id} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg">
              <Icon name="FileAudio" size={18} color="var(--color-primary)" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">{formatSize(f.size)}</p>
              </div>
              <Icon name="CheckCircle2" size={16} className="text-emerald-400 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUploadZone;