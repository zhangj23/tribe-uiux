'use client';

import { useEffect, useRef } from 'react';
import { useHistory } from '@/hooks/useHistory';

interface Props {
  open: boolean;
  onClose: () => void;
}

function toneFor(score: number): string {
  if (score <= 3) return 'phosphor';
  if (score <= 5) return 'cyan';
  if (score <= 7) return 'amber';
  return 'red';
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['?'], label: 'Show this help' },
  { keys: ['N'], label: 'Start a new analysis' },
  { keys: ['/'], label: 'Focus the history search' },
  { keys: ['Esc'], label: 'Cancel / close / go back' },
  { keys: ['Enter'], label: 'Confirm the current action' },
];

export default function KeyboardHelp({ open, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { entries } = useHistory();

  useEffect(() => {
    if (!open) return;
    // Focus the dialog when opened for keyboard users.
    dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const recent = entries
    .filter(e => typeof e.job.friction_score === 'number')
    .slice(0, 3);

  return (
    <div
      className="kbd-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="kbd-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kbd-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="kbd-dialog-header">
          <h2 id="kbd-title" className="kbd-dialog-title">Keyboard shortcuts</h2>
          <button
            type="button"
            className="kbd-dialog-close"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            ×
          </button>
        </header>
        <ul className="kbd-list">
          {SHORTCUTS.map(({ keys, label }) => (
            <li key={label} className="kbd-item">
              <span className="kbd-keys">
                {keys.map((k, i) => (
                  <kbd key={i} className="kbd">{k}</kbd>
                ))}
              </span>
              <span className="kbd-label">{label}</span>
            </li>
          ))}
        </ul>

        {recent.length > 0 && (
          <section className="kbd-recent" aria-label="Most recent friction scores">
            <h3 className="kbd-recent-title">Recent runs</h3>
            <ul className="kbd-recent-list">
              {recent.map(entry => {
                const score = entry.job.friction_score!;
                const tone = toneFor(score);
                const name = entry.label || entry.fileName;
                return (
                  <li key={entry.id} className={`kbd-recent-item kbd-recent-item--${tone}`}>
                    <span className="kbd-recent-score">{score.toFixed(1)}</span>
                    <span className="kbd-recent-name" title={name}>{name}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <footer className="kbd-dialog-footer">
          Press <kbd className="kbd">?</kbd> or <kbd className="kbd">Esc</kbd> to close.
        </footer>
      </div>
    </div>
  );
}
