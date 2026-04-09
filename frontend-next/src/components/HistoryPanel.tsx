'use client';

import { useHistory } from '@/hooks/useHistory';
import type { HistoryEntry } from '@/lib/history';
import type { Job } from '@/types';

function verdictForScore(score: number | undefined): { label: string; tone: string } {
  if (score == null) return { label: '—', tone: 'dim' };
  if (score <= 3) return { label: 'Low friction', tone: 'phosphor' };
  if (score <= 5) return { label: 'Healthy', tone: 'cyan' };
  if (score <= 7) return { label: 'Moderate', tone: 'amber' };
  return { label: 'High friction', tone: 'red' };
}

function typeGlyph(type: HistoryEntry['fileType']) {
  switch (type) {
    case 'image': return '🖼';
    case 'video': return '🎬';
    case 'audio': return '🎵';
    default: return '📄';
  }
}

function timeAgo(ts: number): string {
  const delta = Math.max(0, Date.now() - ts);
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

interface Props {
  onOpen: (job: Job) => void;
}

export default function HistoryPanel({ onOpen }: Props) {
  const { entries, remove, clear } = useHistory();

  if (entries.length === 0) return null;

  return (
    <section className="history-panel" aria-labelledby="history-title">
      <div className="history-header">
        <div className="history-header-text">
          <h3 id="history-title">Recent analyses</h3>
          <p className="history-sub">Stored locally in your browser — private to this device.</p>
        </div>
        <button
          type="button"
          className="history-clear"
          onClick={() => {
            if (confirm('Clear all local analysis history?')) clear();
          }}
        >
          Clear all
        </button>
      </div>

      <ul className="history-list">
        {entries.map(entry => {
          const score = entry.job.friction_score;
          const verdict = verdictForScore(score);
          return (
            <li key={entry.id} className={`history-card history-card--${verdict.tone}`}>
              <button
                type="button"
                className="history-card-main"
                onClick={() => onOpen(entry.job as Job)}
                aria-label={`Open analysis for ${entry.fileName}`}
              >
                <div className="history-score" aria-hidden>
                  <span className="history-score-value">{score != null ? score.toFixed(1) : '—'}</span>
                  <span className="history-score-scale">/10</span>
                </div>
                <div className="history-meta">
                  <div className="history-meta-row">
                    <span className="history-glyph" aria-hidden>{typeGlyph(entry.fileType)}</span>
                    <span className="history-filename" title={entry.fileName}>{entry.fileName}</span>
                  </div>
                  <div className="history-meta-row history-meta-row--secondary">
                    <span className="history-verdict">{verdict.label}</span>
                    <span className="history-time">{timeAgo(entry.savedAt)}</span>
                  </div>
                </div>
              </button>
              <button
                type="button"
                className="history-remove"
                onClick={(e) => { e.stopPropagation(); remove(entry.id); }}
                aria-label={`Remove ${entry.fileName} from history`}
                title="Remove"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
