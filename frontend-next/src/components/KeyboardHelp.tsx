'use client';

import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
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

  useEffect(() => {
    if (!open) return;
    // Focus the dialog when opened for keyboard users.
    dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

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
        <footer className="kbd-dialog-footer">
          Press <kbd className="kbd">?</kbd> or <kbd className="kbd">Esc</kbd> to close.
        </footer>
      </div>
    </div>
  );
}
