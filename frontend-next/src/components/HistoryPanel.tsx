'use client';

import { useState, useCallback, KeyboardEvent } from 'react';
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
  const { entries, remove, rename, clear } = useHistory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const beginEdit = useCallback((entry: HistoryEntry) => {
    setEditingId(entry.id);
    setDraft(entry.label ?? entry.fileName);
  }, []);

  const commitEdit = useCallback(() => {
    if (editingId == null) return;
    rename(editingId, draft);
    setEditingId(null);
    setDraft('');
  }, [editingId, draft, rename]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setDraft('');
  }, []);

  const onKey = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  }, [commitEdit, cancelEdit]);

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
          const displayName = entry.label || entry.fileName;
          const isEditing = editingId === entry.id;
          return (
            <li key={entry.id} className={`history-card history-card--${verdict.tone}`}>
              <div className="history-card-main">
                <button
                  type="button"
                  className="history-card-open"
                  onClick={() => onOpen(entry.job as Job)}
                  aria-label={`Open analysis for ${displayName}`}
                >
                  <div className="history-score" aria-hidden>
                    <span className="history-score-value">{score != null ? score.toFixed(1) : '—'}</span>
                    <span className="history-score-scale">/10</span>
                  </div>
                </button>
                <div className="history-meta">
                  <div className="history-meta-row">
                    <span className="history-glyph" aria-hidden>{typeGlyph(entry.fileType)}</span>
                    {isEditing ? (
                      <input
                        className="history-label-input"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={onKey}
                        onBlur={commitEdit}
                        autoFocus
                        aria-label="Rename analysis"
                        maxLength={80}
                      />
                    ) : (
                      <button
                        type="button"
                        className="history-filename"
                        title={displayName}
                        onClick={() => onOpen(entry.job as Job)}
                        onDoubleClick={() => beginEdit(entry)}
                      >
                        {displayName}
                      </button>
                    )}
                  </div>
                  <div className="history-meta-row history-meta-row--secondary">
                    <span className="history-verdict">{verdict.label}</span>
                    <span className="history-time">{timeAgo(entry.savedAt)}</span>
                  </div>
                </div>
              </div>

              <div className="history-actions">
                <button
                  type="button"
                  className="history-action"
                  onClick={() => beginEdit(entry)}
                  aria-label={`Rename ${displayName}`}
                  title="Rename"
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="history-action history-action--danger"
                  onClick={() => remove(entry.id)}
                  aria-label={`Remove ${displayName} from history`}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
