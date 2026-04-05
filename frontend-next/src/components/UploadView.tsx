'use client';

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';

const ALLOWED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif',
  '.mp4', '.mov', '.avi', '.mkv', '.webm',
  '.mp3', '.wav', '.ogg', '.flac', '.m4a',
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024;

function getFileIcon(file: File): string {
  if (file.type.startsWith('image/')) return '🖼';
  if (file.type.startsWith('video/')) return '🎬';
  if (file.type.startsWith('audio/')) return '🎵';
  return '📄';
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAllowedFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

interface Props {
  onStartProcessing: (jobId: string) => void;
}

export default function UploadView({ onStartProcessing }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectFile = useCallback((file: File) => {
    setError('');
    if (!isAllowedFile(file)) {
      setError('File type not supported. Please upload an image, video, or audio file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File too large. Maximum size is 100 MB.');
      return;
    }
    setSelectedFile(file);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
  }, [selectFile]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) selectFile(file);
    e.target.value = '';
  }, [selectFile]);

  const uploadFile = async () => {
    if (!selectedFile || uploading) return;
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const resp = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.detail || 'Upload failed. Please try again.');
        return;
      }
      onStartProcessing(data.job_id);
    } catch {
      setError('Upload failed. Please check your connection and try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-container view-enter">
      <div className="upload-hero">
        <h2 className="upload-title">
          <span className="title-line">Analyze <em>Neural</em></span>
          <span className="title-line">Response to Media</span>
        </h2>
        <p className="upload-desc">
          Upload an image, video, or audio file to simulate how the human brain responds.
          Powered by Meta&apos;s TRIBE v2 brain encoding model.
        </p>
      </div>

      <div
        className={`dropzone${dragOver ? ' drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
      >
        <div className="dropzone-inner">
          <svg className="dropzone-icon" width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="4" y="8" width="32" height="26" rx="3" stroke="#363b4f" strokeWidth="1.5" />
            <path d="M13 22l4-5 4 5 5-7 5 7" stroke="#39ff85" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
          </svg>
          <p className="dropzone-text">
            Drop file here or{' '}
            <button
              className="dropzone-browse"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              browse
            </button>
          </p>
          <div className="dropzone-formats">
            {['PNG', 'JPG', 'WEBP', 'MP4', 'MOV', 'MP3', 'WAV', 'M4A'].map(f => (
              <span key={f} className="format-tag">{f}</span>
            ))}
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {error && <div className="error-banner">{error}</div>}

      {selectedFile && (
        <div className="upload-meta">
          <div className="file-preview">
            <span className="file-icon">{getFileIcon(selectedFile)}</span>
            <div className="file-info">
              <span className="file-name">{selectedFile.name}</span>
              <span className="file-size">{formatSize(selectedFile.size)}</span>
            </div>
            <button className="file-remove" onClick={() => setSelectedFile(null)}>×</button>
          </div>
          <button className="btn-analyze" onClick={uploadFile} disabled={uploading}>
            {uploading ? 'Uploading...' : (
              <>Begin Analysis <span className="btn-arrow">→</span></>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
