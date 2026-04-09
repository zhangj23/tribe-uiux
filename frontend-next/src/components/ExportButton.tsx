'use client';

import { useCallback, useEffect, useState } from 'react';
import { copyToClipboard, formatJobAsText } from '@/lib/exportFormatter';
import type { Job } from '@/types';

interface Props {
  job: Job;
  label?: string;
  note?: string;
}

type ToastState = 'idle' | 'success' | 'error';

export default function ExportButton({ job, label, note }: Props) {
  const [toast, setToast] = useState<ToastState>('idle');

  useEffect(() => {
    if (toast === 'idle') return;
    const t = setTimeout(() => setToast('idle'), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const handleCopy = useCallback(async () => {
    const text = formatJobAsText(job, { title: label, note });
    const ok = await copyToClipboard(text);
    setToast(ok ? 'success' : 'error');
  }, [job, label, note]);

  const disabled = job.friction_score == null;

  return (
    <div className="export-button-wrap">
      <button
        type="button"
        className="export-button"
        onClick={handleCopy}
        disabled={disabled}
        aria-label={disabled ? 'Waiting for analysis to complete' : 'Copy analysis summary to clipboard'}
        title={disabled ? 'Waiting for analysis to complete' : 'Copy summary to clipboard'}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <rect x="3" y="3" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5 3V2a1 1 0 011-1h4a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
        <span>Copy summary</span>
      </button>
      {toast !== 'idle' && (
        <span
          className={`export-toast export-toast--${toast}`}
          role="status"
          aria-live="polite"
        >
          {toast === 'success' ? 'Copied ✓' : 'Copy failed'}
        </span>
      )}
    </div>
  );
}
