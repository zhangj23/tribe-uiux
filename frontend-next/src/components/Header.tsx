'use client';

import { useHealth } from '@/hooks/useHealth';

export default function Header() {
  const health = useHealth();

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

  return (
    <header className="app-header">
      <div className="header-left">
        <svg className="logo-mark" width="28" height="28" viewBox="0 0 28 28" fill="none">
          <ellipse cx="14" cy="14" rx="11" ry="9" stroke="#39ff85" strokeWidth="1.2" opacity="0.6" />
          <ellipse cx="14" cy="14" rx="6" ry="5" stroke="#00d4ff" strokeWidth="1" opacity="0.4" />
          <circle cx="14" cy="14" r="2" fill="#39ff85" opacity="0.8" />
          <line x1="14" y1="5" x2="14" y2="23" stroke="#363b4f" strokeWidth="0.8" strokeDasharray="2 2" />
        </svg>
        <div className="header-title">
          <h1><span className="title-accent">TRIBE</span> UX</h1>
          <p className="header-subtitle">Neural Response Analyzer v0.1</p>
        </div>
      </div>
      <div className="header-right">
        <div className="status-indicator" role="status" aria-live="polite">
          <span className="status-dot" style={dotStyle} />
          <span className="status-text">{statusText}</span>
        </div>
      </div>
    </header>
  );
}
