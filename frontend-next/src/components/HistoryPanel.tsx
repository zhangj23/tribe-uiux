'use client';

import { useState, useCallback, useMemo, KeyboardEvent } from 'react';
import { useHistory } from '@/hooks/useHistory';
import type { HistoryEntry } from '@/lib/history';

function matchesQuery(entry: HistoryEntry, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const hay = [
    entry.label,
    entry.fileName,
    entry.fileType,
    new Date(entry.savedAt).toLocaleDateString(),
    new Date(entry.savedAt).toLocaleString('en-US', { month: 'long' }),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

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
  onOpen: (entry: HistoryEntry) => void;
  onCompare?: (a: HistoryEntry, b: HistoryEntry) => void;
}

export default function HistoryPanel({ onOpen, onCompare }: Props) {
  const { entries, remove, rename, togglePin, setNote, clear } = useHistory();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const filteredEntries = useMemo(() => {
    const matched = entries.filter(e => matchesQuery(e, query));
    // Pinned first, then by savedAt descending. Stable sort preserves the
    // existing order within each bucket.
    return matched.slice().sort((a, b) => {
      const aPinned = a.pinned ? 1 : 0;
      const bPinned = b.pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return b.savedAt - a.savedAt;
    });
  }, [entries, query]);

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

  const beginNote = useCallback((entry: HistoryEntry) => {
    setOpenNoteId(entry.id);
    setNoteDraft(entry.note ?? '');
  }, []);

  const closeNote = useCallback(() => {
    setOpenNoteId(null);
    setNoteDraft('');
  }, []);

  const saveNote = useCallback(() => {
    if (openNoteId == null) return;
    setNote(openNoteId, noteDraft);
    closeNote();
  }, [openNoteId, noteDraft, setNote, closeNote]);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) {
        // Already have 2 — replace the oldest so users can quickly swap out
        // their first pick without having to uncheck manually.
        return [prev[1], id];
      }
      return [...prev, id];
    });
  }, []);

  const runCompare = useCallback(() => {
    if (selected.length !== 2 || !onCompare) return;
    const a = entries.find(e => e.id === selected[0]);
    const b = entries.find(e => e.id === selected[1]);
    if (a && b) {
      onCompare(a, b);
      setCompareMode(false);
      setSelected([]);
    }
  }, [selected, entries, onCompare]);

  const exitCompareMode = useCallback(() => {
    setCompareMode(false);
    setSelected([]);
  }, []);

  if (entries.length === 0) {
    return (
      <section className="history-panel history-panel--empty" aria-labelledby="history-title">
        <div className="history-empty">
          <div className="history-empty-mark" aria-hidden>
            <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
              <rect x="6" y="10" width="30" height="24" rx="3" stroke="#363b4f" strokeWidth="1.5" />
              <line x1="12" y1="18" x2="30" y2="18" stroke="#363b4f" strokeWidth="1.2" />
              <line x1="12" y1="24" x2="26" y2="24" stroke="#363b4f" strokeWidth="1.2" />
              <line x1="12" y1="30" x2="22" y2="30" stroke="#363b4f" strokeWidth="1.2" />
            </svg>
          </div>
          <h3 id="history-title" className="history-empty-title">No analyses yet</h3>
          <p className="history-empty-text">
            Once you analyze a creative, it will appear here. Run a few and you can
            compare friction scores side-by-side to see which version wins.
          </p>
        </div>
      </section>
    );
  }

  const canCompare = entries.length >= 2 && !!onCompare;

  return (
    <section className="history-panel" aria-labelledby="history-title">
      <div className="history-header">
        <div className="history-header-text">
          <h3 id="history-title">Recent analyses</h3>
          <p className="history-sub">
            {compareMode
              ? `Pick ${2 - selected.length} more to compare.`
              : 'Stored locally in your browser — private to this device. Double-click a name to rename.'}
          </p>
        </div>
        <div className="history-header-actions">
          {!compareMode && (
            <div className="history-search-wrap">
              <input
                type="search"
                className="history-search"
                placeholder="Search analyses…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setQuery(''); }}
                aria-label="Search saved analyses by name or date"
              />
              {query && (
                <button
                  type="button"
                  className="history-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          )}
          {canCompare && !compareMode && (
            <button
              type="button"
              className="history-compare-btn"
              onClick={() => setCompareMode(true)}
            >
              Compare two
            </button>
          )}
          {compareMode && (
            <>
              <button
                type="button"
                className="history-compare-btn history-compare-btn--primary"
                onClick={runCompare}
                disabled={selected.length !== 2}
              >
                Compare →
              </button>
              <button
                type="button"
                className="history-clear"
                onClick={exitCompareMode}
              >
                Cancel
              </button>
            </>
          )}
          {!compareMode && (
            <button
              type="button"
              className="history-clear"
              onClick={() => {
                if (confirm('Clear all local analysis history?')) clear();
              }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {filteredEntries.length === 0 && query && (
        <div className="history-no-results">
          <p>No analyses match &ldquo;{query}&rdquo;.</p>
          <button type="button" className="history-clear" onClick={() => setQuery('')}>
            Clear search
          </button>
        </div>
      )}

      <ul className="history-list">
        {filteredEntries.map(entry => {
          const score = entry.job.friction_score;
          const verdict = verdictForScore(score);
          const displayName = entry.label || entry.fileName;
          const isEditing = editingId === entry.id;
          const isSelected = selected.includes(entry.id);
          const cardClass =
            `history-card history-card--${verdict.tone}${compareMode ? ' history-card--selectable' : ''}${isSelected ? ' is-selected' : ''}${entry.pinned ? ' is-pinned' : ''}`;

          if (compareMode) {
            return (
              <li key={entry.id} className={cardClass}>
                <button
                  type="button"
                  className="history-card-main history-card-select"
                  onClick={() => toggleSelect(entry.id)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      toggleSelect(entry.id);
                    }
                  }}
                  aria-pressed={isSelected}
                  aria-label={`${isSelected ? 'Deselect' : 'Select'} ${displayName} for comparison`}
                >
                  <span className={`history-checkbox${isSelected ? ' is-checked' : ''}`} aria-hidden>
                    {isSelected ? '✓' : ''}
                  </span>
                  <div className="history-score" aria-hidden>
                    <span className="history-score-value">{score != null ? score.toFixed(1) : '—'}</span>
                    <span className="history-score-scale">/10</span>
                  </div>
                  <div className="history-meta">
                    <div className="history-meta-row">
                      <span className="history-glyph" aria-hidden>{typeGlyph(entry.fileType)}</span>
                      <span className="history-filename">{displayName}</span>
                    </div>
                    <div className="history-meta-row history-meta-row--secondary">
                      <span className="history-verdict">{verdict.label}</span>
                      <span className="history-time">{timeAgo(entry.savedAt)}</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          }

          return (
            <li key={entry.id} className={cardClass}>
              <div className="history-card-main">
                <button
                  type="button"
                  className="history-card-open"
                  onClick={() => onOpen(entry)}
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
                        onClick={() => onOpen(entry)}
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

              {entry.pinned && (
                <span className="history-pin-badge" aria-hidden title="Pinned — won't be evicted">
                  ★
                </span>
              )}

              <div className="history-actions">
                <button
                  type="button"
                  className={`history-action${entry.pinned ? ' history-action--active' : ''}`}
                  onClick={() => togglePin(entry.id)}
                  aria-label={entry.pinned ? `Unpin ${displayName}` : `Pin ${displayName}`}
                  aria-pressed={!!entry.pinned}
                  title={entry.pinned ? 'Unpin' : 'Pin to top'}
                >
                  ★
                </button>
                <button
                  type="button"
                  className={`history-action${entry.note ? ' history-action--active' : ''}`}
                  onClick={() => beginNote(entry)}
                  aria-label={entry.note ? `Edit note for ${displayName}` : `Add note for ${displayName}`}
                  title={entry.note ? 'Edit note' : 'Add note'}
                >
                  {/* Pencil-on-paper glyph; the css class drives the active color */}
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
                    <rect x="2" y="2" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.2" />
                    <line x1="4" y1="5" x2="8" y2="5" stroke="currentColor" strokeWidth="1.2" />
                    <line x1="4" y1="7" x2="8" y2="7" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </button>
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

              {/* Inline note editor / preview */}
              {openNoteId === entry.id ? (
                <div className="history-note history-note--editing">
                  <textarea
                    className="history-note-input"
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') { e.preventDefault(); closeNote(); }
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        saveNote();
                      }
                    }}
                    placeholder="Add a note: client feedback, version notes, todos…"
                    autoFocus
                    rows={3}
                    maxLength={500}
                    aria-label="Note for this analysis"
                  />
                  <div className="history-note-actions">
                    <span className="history-note-hint">⌘/Ctrl + Enter to save · Esc to cancel</span>
                    <button type="button" className="history-clear" onClick={closeNote}>Cancel</button>
                    <button
                      type="button"
                      className="history-compare-btn history-compare-btn--primary"
                      onClick={saveNote}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : entry.note ? (
                <button
                  type="button"
                  className="history-note history-note--preview"
                  onClick={() => beginNote(entry)}
                  aria-label="Edit note"
                >
                  {entry.note}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
