'use client';

import ProcessingCanvas from './ProcessingCanvas';
import { usePolling } from '@/hooks/usePolling';
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

interface Props {
  jobId: string;
  onComplete: (data: Job) => void;
  onCancel: () => void;
}

export default function ProcessingView({ jobId, onComplete, onCancel }: Props) {
  const { progress, stage } = usePolling(jobId, onComplete);
  const pct = Math.round(progress * 100);

  return (
    <div className="processing-container view-enter">
      <div className="processing-brain">
        <ProcessingCanvas />
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
