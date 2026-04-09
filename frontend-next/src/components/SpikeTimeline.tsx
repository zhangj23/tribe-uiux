'use client';

import { useMemo } from 'react';
import type { Timeseries } from '@/types';

const METRICS: { key: keyof Timeseries; label: string; higherIsBad: boolean }[] = [
  { key: 'cognitive_load', label: 'Cognitive load', higherIsBad: true },
  { key: 'reading_language', label: 'Reading load', higherIsBad: true },
  { key: 'attention_salience', label: 'Attention', higherIsBad: false },
  { key: 'emotional_response', label: 'Emotion', higherIsBad: false },
  { key: 'visual_processing', label: 'Visual', higherIsBad: false },
  { key: 'object_recognition', label: 'Subject', higherIsBad: false },
];

interface Spike {
  time: number;
  metric: string;
  label: string;
  value: number;
  /** How meaningful / urgent this spike is, 0-1 */
  intensity: number;
  tone: 'phosphor' | 'cyan' | 'amber' | 'red';
}

/**
 * Find the top spike moments across all metrics. A spike is any timestep
 * whose value exceeds its own mean + 1.2 * stddev (or drops below mean - 1.2σ
 * for "lower is better" metrics we also care about crashes).
 */
function findSpikes(timeseries: Timeseries, timestamps: number[]): Spike[] {
  if (!timeseries || !timestamps?.length) return [];
  const out: Spike[] = [];

  for (const { key, label, higherIsBad } of METRICS) {
    const series = timeseries[key];
    if (!series || series.length === 0) continue;

    const mean = series.reduce((a, b) => a + b, 0) / series.length;
    const variance =
      series.reduce((acc, v) => acc + (v - mean) ** 2, 0) / series.length;
    const std = Math.sqrt(variance) || 0.0001;
    const threshold = 1.2;

    // Track the single highest-magnitude spike per metric so the timeline
    // isn't overwhelmed by a dozen adjacent samples from the same ripple.
    let best: Spike | null = null;

    for (let i = 0; i < series.length; i++) {
      const v = series[i];
      const zLocal = (v - mean) / std;
      if (Math.abs(zLocal) < threshold) continue;

      const intensity = Math.min(1, Math.abs(zLocal) / 3);
      const isBad =
        (higherIsBad && zLocal > 0) || (!higherIsBad && zLocal < 0);
      const tone: Spike['tone'] =
        intensity > 0.75 && isBad ? 'red'
        : isBad ? 'amber'
        : intensity > 0.75 ? 'phosphor'
        : 'cyan';

      const candidate: Spike = {
        time: timestamps[i] ?? i,
        metric: String(key),
        label,
        value: v,
        intensity,
        tone,
      };
      if (!best || candidate.intensity > best.intensity) best = candidate;
    }

    if (best) out.push(best);
  }

  // Rank by intensity, cap to the most meaningful six so it stays scannable.
  return out.sort((a, b) => b.intensity - a.intensity).slice(0, 6);
}

interface Props {
  timeseries?: Timeseries;
  timestamps?: number[];
}

export default function SpikeTimeline({ timeseries, timestamps }: Props) {
  const spikes = useMemo(
    () => (timeseries && timestamps ? findSpikes(timeseries, timestamps) : []),
    [timeseries, timestamps]
  );

  if (!timestamps || timestamps.length === 0 || spikes.length === 0) {
    return null;
  }

  const totalTime = timestamps[timestamps.length - 1] ?? 1;

  return (
    <section className="spike-timeline" aria-label="Neural spike timeline">
      <div className="spike-timeline-header">
        <span className="spike-timeline-eyebrow">When it happened</span>
        <span className="spike-timeline-sub">Top {spikes.length} spikes across the run</span>
      </div>
      <div className="spike-timeline-track" role="list">
        <div className="spike-timeline-axis">
          <span>0.0s</span>
          <span>{(totalTime / 2).toFixed(1)}s</span>
          <span>{totalTime.toFixed(1)}s</span>
        </div>
        <div className="spike-timeline-line">
          {spikes.map((spike, i) => {
            const left = Math.max(0, Math.min(1, spike.time / (totalTime || 1))) * 100;
            const size = 10 + spike.intensity * 14;
            return (
              <div
                key={`${spike.metric}-${i}`}
                role="listitem"
                className={`spike-dot spike-dot--${spike.tone}`}
                style={{
                  left: `${left}%`,
                  width: size,
                  height: size,
                }}
                title={`${spike.label} @ ${spike.time.toFixed(1)}s`}
                tabIndex={0}
                aria-label={`${spike.label} spike at ${spike.time.toFixed(1)} seconds`}
              >
                <span className="spike-tooltip">
                  <strong>{spike.label}</strong>
                  <span>{spike.time.toFixed(1)}s</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
