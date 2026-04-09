'use client';

import { useHealth } from '@/hooks/useHealth';

interface Props {
  onShowShortcuts?: () => void;
  /** Click handler for the logo / brand mark. When omitted (or on the
   * upload view itself) the brand renders as a static element. */
  onHome?: () => void;
  isHome?: boolean;
}

export default function Header({ onShowShortcuts, onHome, isHome }: Props) {
  const health = useHealth();
  const homeable = !!onHome && !isHome;

  let dotStyle: React.CSSProperties;
  let statusText: string;

  if (health.state === 'loading') {
    dotStyle = { background: 'var(--text-dim)', boxShadow: 'none' };
    statusText = 'CONNECTING...';
  } else if (health.state === 'offline') {
    dotStyle = { background: 'var(--red)', boxShadow: '0 0 8px var(--red-dim)' };
    statusText = 'OFFLINE';
  } else if (health.data.tribe_mock_mode) {
    dotStyle = { background: 'var(--amber)', boxShadow: '0 0 8px var(--amber-dim)' };
    statusText = 'MOCK MODE';
  } else if (health.data.model_loaded) {
    dotStyle = { background: 'var(--phosphor)', boxShadow: '0 0 8px var(--phosphor-dim)' };
    statusText = 'MODEL READY';
  } else {
    dotStyle = { background: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan-dim)' };
    statusText = 'LOADING MODEL';
  }

  const Brand = (
    <>
      <svg className="logo-mark" width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <ellipse cx="14" cy="14" rx="11" ry="9" stroke="#39ff85" strokeWidth="1.2" opacity="0.6" />
        <ellipse cx="14" cy="14" rx="6" ry="5" stroke="#00d4ff" strokeWidth="1" opacity="0.4" />
        <circle cx="14" cy="14" r="2" fill="#39ff85" opacity="0.8" />
        <line x1="14" y1="5" x2="14" y2="23" stroke="#363b4f" strokeWidth="0.8" strokeDasharray="2 2" />
      </svg>
      <div className="header-title">
        <h1><span className="title-accent">TRIBE</span> UX</h1>
        <p className="header-subtitle">Neural Response Analyzer v0.1</p>
      </div>
    </>
  );

  return (
    <header className="app-header">
      {homeable ? (
        <button
          type="button"
          className="header-left header-left--link"
          onClick={onHome}
          aria-label="Back to upload"
          title="Back to upload"
        >
          {Brand}
        </button>
      ) : (
        <div className="header-left">{Brand}</div>
      )}
      <div className="header-right">
        {onShowShortcuts && (
          <button
            type="button"
            className="header-help"
            onClick={onShowShortcuts}
            aria-label="Show keyboard shortcuts"
            title="Keyboard shortcuts (press ?)"
          >
            ?
          </button>
        )}
        <div className="status-indicator" role="status" aria-live="polite">
          <span className="status-dot" style={dotStyle} />
          <span className="status-text">{statusText}</span>
        </div>
      </div>
    </header>
  );
}
