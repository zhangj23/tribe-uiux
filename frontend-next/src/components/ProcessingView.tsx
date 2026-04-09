'use client';

import { useEffect, useState, useMemo } from 'react';
import ProcessingCanvas from './ProcessingCanvas';
import { usePolling } from '@/hooks/usePolling';
import { useHistory } from '@/hooks/useHistory';
import type { Job } from '@/types';

const STAGES = [
  { key: 'converting',   label: 'Converting media' },
  { key: 'predicting',   label: 'Running neural prediction' },
  { key: 'mapping',      label: 'Analyzing brain regions' },
  { key: 'interpreting', label: 'Generating recommendations' },
] as const;

const STAGE_ORDER = STAGES.map(s => s.key);

function getStageState(stageKey: string, currentStatus: string): 'active' | 'done' | '' {
  const currentIdx = STAGE_ORDER.indexOf(currentStatus as typeof STAGE_ORDER[number]);
  const stageIdx = STAGE_ORDER.indexOf(stageKey as typeof STAGE_ORDER[number]);
  if (stageIdx < 0) return '';
  if (stageIdx === currentIdx) return 'active';
  if (stageIdx < currentIdx) return 'done';
  return '';
}

function getTitle(status: string): string {
  switch (status) {
    case 'converting':   return 'Converting media...';
    case 'predicting':   return 'Running TRIBE v2 neural prediction...';
    case 'mapping':      return 'Mapping brain regions...';
    case 'interpreting': return 'Generating recommendations...';
    case 'completed':    return 'Analysis complete';
    case 'failed':       return 'Analysis failed';
    default:             return 'Initializing...';
  }
}

function fmtSeconds(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

interface Props {
  jobId: string;
  onComplete: (data: Job) => void;
  onCancel: () => void;
}

export default function ProcessingView({ jobId, onComplete, onCancel }: Props) {
  const { progress, stage, error } = usePolling(jobId, onComplete);
  const pct = Math.round(progress * 100);
  const { entries } = useHistory();
  const [elapsed, setElapsed] = useState(0);

  // Average duration of the last 5 successful runs (anything with a duration).
  const typicalMs = useMemo(() => {
    const durations = entries
      .map(e => e.durationMs)
      .filter((d): d is number => typeof d === 'number' && d > 0)
      .slice(0, 5);
    if (durations.length === 0) return null;
    return durations.reduce((a, b) => a + b, 0) / durations.length;
  }, [entries]);

  // Local stopwatch — restarts whenever the polled jobId changes.
  useEffect(() => {
    setElapsed(0);
    const start = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - start), 500);
    return () => clearInterval(id);
  }, [jobId]);

  if (error) {
    return (
      <div className="processing-container view-enter">
        <div className="processing-error">
          <div className="processing-error-mark">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
              <circle cx="28" cy="28" r="25" stroke="#ff4d6a" strokeWidth="1.5" opacity="0.6" />
              <path d="M20 20l16 16M36 20L20 36" stroke="#ff4d6a" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2 className="processing-error-title">
            {error.kind === 'network'
              ? 'Connection lost'
              : error.kind === 'timeout'
              ? 'Taking too long'
              : 'Analysis failed'}
          </h2>
          <p className="processing-error-message">{error.message}</p>
          <div className="processing-error-actions">
            <button className="btn-analyze" onClick={onCancel}>
              Back to upload <span className="btn-arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Decide what time text to show under the progress bar.
  let etaLine: string | null = null;
  if (typicalMs) {
    const remaining = Math.max(0, typicalMs - elapsed);
    if (elapsed < typicalMs) {
      etaLine = `~${fmtSeconds(remaining)} remaining · typical run is ${fmtSeconds(typicalMs)}`;
    } else {
      etaLine = `Running long — typical is ${fmtSeconds(typicalMs)}, currently ${fmtSeconds(elapsed)}`;
    }
  } else {
    etaLine = `${fmtSeconds(elapsed)} elapsed`;
  }

  return (
    <div className="processing-container view-enter">
      <div className="processing-brain">
        <ProcessingCanvas stage={stage} />
      </div>

      <div className="processing-info">
        <p className="processing-title">{getTitle(stage)}</p>

        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${pct}%` }} />
          <div className="progress-glow" style={{ left: `calc(${pct}% - 30px)` }} />
        </div>
        <div className="progress-meta">
          <span>{pct}%</span>
          <span>{stage.toUpperCase() || 'CREATED'}</span>
        </div>
        <p className="processing-eta" aria-live="polite">{etaLine}</p>

        <div className="processing-stages">
          {STAGES.map((s, i) => {
            const state = getStageState(s.key, stage);
            return (
              <div key={s.key} className={`stage${state ? ' ' + state : ''}`}>
                <span className="stage-num">0{i + 1}</span>
                <span className="stage-label">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <button className="btn-cancel" onClick={onCancel}>Cancel</button>
    </div>
  );
}
