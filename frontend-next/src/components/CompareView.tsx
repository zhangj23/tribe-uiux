'use client';

import { useEffect, useMemo } from 'react';
import { compareJobs, type MetricDelta } from '@/lib/compareDelta';
import type { HistoryEntry } from '@/lib/history';
import type { Job } from '@/types';

function signed(n: number): string {
  if (n > 0) return `+${n.toFixed(2)}`;
  return n.toFixed(2); // includes 0.00 and -1.23 natively
}

interface Props {
  entryA: HistoryEntry;
  entryB: HistoryEntry;
  onOpenA: (job: Job) => void;
  onOpenB: (job: Job) => void;
  onExit: () => void;
}

function nameOf(e: HistoryEntry) {
  return e.label || e.fileName;
}

function formatDelta(n: number): string {
  return signed(n);
}

function frictionVerdict(score: number | null): { label: string; tone: string } {
  if (score == null) return { label: '—', tone: 'dim' };
  if (score <= 3) return { label: 'Low friction', tone: 'phosphor' };
  if (score <= 5) return { label: 'Healthy', tone: 'cyan' };
  if (score <= 7) return { label: 'Moderate', tone: 'amber' };
  return { label: 'High friction', tone: 'red' };
}

function WinnerBadge({ side, label }: { side: 'a' | 'b' | 'tie' | 'unknown'; label?: string }) {
  if (side === 'unknown') return null;
  if (side === 'tie') return <span className="compare-winner compare-winner--tie">TIE</span>;
  return (
    <span className={`compare-winner compare-winner--${side}`}>
      {label ?? `Version ${side.toUpperCase()} wins`}
    </span>
  );
}

function MetricRow({ row }: { row: MetricDelta }) {
  return (
    <tr className={`compare-row compare-row--winner-${row.winner}`}>
      <td className="compare-cell compare-cell--label">{row.label}</td>
      <td className="compare-cell compare-cell--num">{signed(row.valA)}</td>
      <td className="compare-cell compare-cell--num">{signed(row.valB)}</td>
      <td className="compare-cell compare-cell--delta">{formatDelta(row.delta)}σ</td>
      <td className="compare-cell compare-cell--win">
        {row.winner === 'tie' ? '—' : `V${row.winner.toUpperCase()}`}
      </td>
    </tr>
  );
}

export default function CompareView({ entryA, entryB, onOpenA, onOpenB, onExit }: Props) {
  const jobA = entryA.job as Job;
  const jobB = entryB.job as Job;
  const result = useMemo(() => compareJobs(jobA, jobB), [jobA, jobB]);

  // Escape key closes the compare view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);

  const verdictA = frictionVerdict(result.frictionA);
  const verdictB = frictionVerdict(result.frictionB);

  const overall = result.overallWinner;
  const overallLabel =
    overall === 'a' ? `${nameOf(entryA)} wins`
    : overall === 'b' ? `${nameOf(entryB)} wins`
    : overall === 'tie' ? 'Effective tie'
    : 'Not enough data';

  return (
    <div className="compare-view view-enter">
      <div className="compare-header">
        <div>
          <span className="compare-eyebrow">COMPARISON</span>
          <h2 className="compare-title">
            <span className="compare-title-a">{nameOf(entryA)}</span>
            <span className="compare-title-sep">vs</span>
            <span className="compare-title-b">{nameOf(entryB)}</span>
          </h2>
        </div>
        <button className="btn-new" onClick={onExit}>← Back</button>
      </div>

      {/* Hero: Friction Score delta */}
      <section className="compare-hero">
        <div className={`compare-hero-card compare-hero-card--${verdictA.tone}${overall === 'a' ? ' is-winner' : ''}`}>
          <span className="compare-hero-eyebrow">Version A</span>
          <div className="compare-hero-score">
            {result.frictionA != null ? result.frictionA.toFixed(1) : '—'}
          </div>
          <span className="compare-hero-verdict">{verdictA.label}</span>
          <p className="compare-hero-filename" title={nameOf(entryA)}>{nameOf(entryA)}</p>
          <button className="compare-hero-open" onClick={() => onOpenA(jobA)}>View full analysis</button>
        </div>

        <div className="compare-hero-middle">
          <WinnerBadge side={overall} label={overallLabel} />
          {result.frictionDelta != null && result.frictionPctChange != null && (
            <div className="compare-hero-delta">
              <span className="compare-hero-delta-label">Friction delta</span>
              <span className="compare-hero-delta-value">
                {formatDelta(result.frictionDelta)}
              </span>
              <span className="compare-hero-delta-pct">
                ({result.frictionPctChange.toFixed(0)}% {result.frictionDelta < 0 ? 'lower' : 'higher'})
              </span>
            </div>
          )}
          <ul className="compare-hero-insights">
            {result.insights.map((ins, i) => (
              <li key={i}>{ins}</li>
            ))}
          </ul>
        </div>

        <div className={`compare-hero-card compare-hero-card--${verdictB.tone}${overall === 'b' ? ' is-winner' : ''}`}>
          <span className="compare-hero-eyebrow">Version B</span>
          <div className="compare-hero-score">
            {result.frictionB != null ? result.frictionB.toFixed(1) : '—'}
          </div>
          <span className="compare-hero-verdict">{verdictB.label}</span>
          <p className="compare-hero-filename" title={nameOf(entryB)}>{nameOf(entryB)}</p>
          <button className="compare-hero-open" onClick={() => onOpenB(jobB)}>View full analysis</button>
        </div>
      </section>

      {/* Metric deltas table */}
      {result.metrics.length > 0 && (
        <section className="compare-table-section">
          <header className="compare-table-header">
            <h3>Metric deltas</h3>
            <span className="compare-table-sub">Z-score change from Version A → Version B</span>
          </header>
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">Version A</th>
                  <th scope="col">Version B</th>
                  <th scope="col" title="Z-score change from Version A to Version B">Change (B − A)</th>
                  <th scope="col">Winner</th>
                </tr>
              </thead>
              <tbody>
                {result.metrics.map(m => <MetricRow key={m.key} row={m} />)}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
