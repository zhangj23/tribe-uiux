'use client';

import { useMemo } from 'react';
import type { HistoryEntry } from '@/lib/history';

interface Props {
  entries: HistoryEntry[];
  width?: number;
  height?: number;
}

interface Point {
  x: number;
  y: number;
  score: number;
  label: string;
  savedAt: number;
}

function toneFor(score: number): string {
  if (score <= 3) return 'var(--phosphor)';
  if (score <= 5) return 'var(--cyan)';
  if (score <= 7) return 'var(--amber)';
  return 'var(--red)';
}

/**
 * Tiny inline sparkline of the user's friction score over the last N runs.
 * Renders nothing if there are fewer than 2 scored analyses.
 */
export default function FrictionSparkline({ entries, width = 220, height = 48 }: Props) {
  const { points, latest, previous, hasData } = useMemo(() => {
    // Oldest-to-newest, most-recent-10, only scored entries.
    const scored = [...entries]
      .slice(0, 10)
      .reverse()
      .filter(e => typeof e.job.friction_score === 'number') as HistoryEntry[];

    if (scored.length < 2) {
      return { points: [] as Point[], latest: null, previous: null, hasData: false };
    }

    const pad = 6;
    const innerW = width - pad * 2;
    const innerH = height - pad * 2;

    const scores = scored.map(e => e.job.friction_score!);
    const maxScore = Math.max(...scores, 10);
    const minScore = Math.min(...scores, 0);
    const range = Math.max(0.5, maxScore - minScore);

    // scored.length is guaranteed >= 2 by the guard above.
    const pts: Point[] = scored.map((e, i) => {
      const score = e.job.friction_score!;
      const x = pad + (i / (scored.length - 1)) * innerW;
      // Invert Y: higher score = higher on chart would be wrong visually since higher friction = worse.
      // Lower friction (better) should visually sit lower but we want "down = good" metaphor.
      // Use conventional: lower y = higher score so the line trends down when friction improves.
      const norm = (score - minScore) / range;
      const y = pad + norm * innerH;
      return { x, y, score, label: e.label || e.fileName, savedAt: e.savedAt };
    });

    return {
      points: pts,
      latest: pts[pts.length - 1],
      previous: pts[pts.length - 2] ?? null,
      hasData: true,
    };
  }, [entries, width, height]);

  if (!hasData || !latest) return null;

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const lastScore = latest.score;
  const prevScore = previous?.score ?? lastScore;
  const delta = lastScore - prevScore;
  const deltaDirection = delta < -0.1 ? 'down' : delta > 0.1 ? 'up' : 'flat';
  const deltaTone = delta < -0.1 ? 'phosphor' : delta > 0.1 ? 'red' : 'dim';
  const deltaLabel =
    deltaDirection === 'down' ? `↓ ${Math.abs(delta).toFixed(1)}`
    : deltaDirection === 'up' ? `↑ ${Math.abs(delta).toFixed(1)}`
    : '→ flat';

  return (
    <div className="sparkline" aria-label={`Friction trend across last ${points.length} analyses`}>
      <div className="sparkline-label">
        <span className="sparkline-title">Your friction trend</span>
        <span className="sparkline-sub">Last {points.length}</span>
      </div>
      <div className="sparkline-chart">
        <svg width={width} height={height} role="img" aria-hidden>
          {/* Guide line at neutral 5.0 — anchored to the score scale used */}
          <line
            x1={0}
            x2={width}
            y1={height / 2}
            y2={height / 2}
            stroke="var(--dim)"
            strokeDasharray="2 3"
            opacity={0.4}
          />
          <path d={pathD} fill="none" stroke={toneFor(lastScore)} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === points.length - 1 ? 3 : 1.8}
              fill={toneFor(p.score)}
            >
              <title>
                {p.score.toFixed(1)}/10 — {p.label}
              </title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="sparkline-current">
        <span className="sparkline-current-score" style={{ color: toneFor(lastScore) }}>
          {lastScore.toFixed(1)}
        </span>
        <span className={`sparkline-delta sparkline-delta--${deltaTone}`}>{deltaLabel}</span>
      </div>
    </div>
  );
}
