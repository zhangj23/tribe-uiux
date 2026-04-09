import type { Job, ZScores } from '@/types';

export type MetricKey = keyof ZScores;

export const METRIC_LABELS: Record<MetricKey, string> = {
  visual_processing: 'Visual Processing',
  object_recognition: 'Object / Face Recognition',
  reading_language: 'Reading & Language',
  attention_salience: 'Attention & Salience',
  cognitive_load: 'Cognitive Load',
  emotional_response: 'Emotional Response',
};

/**
 * For most metrics, higher engagement is good. For cognitive load it's bad.
 * This controls which side wins a delta and is used to build insights.
 */
export const HIGHER_IS_BETTER: Record<MetricKey, boolean> = {
  visual_processing: true,
  object_recognition: true,
  reading_language: false, // reading cost is load; lower is friendlier
  attention_salience: true,
  cognitive_load: false,
  emotional_response: true,
};

export interface MetricDelta {
  key: MetricKey;
  label: string;
  valA: number;
  valB: number;
  delta: number; // B - A
  winner: 'a' | 'b' | 'tie';
  higherIsBetter: boolean;
}

export interface CompareResult {
  frictionA: number | null;
  frictionB: number | null;
  frictionDelta: number | null; // B - A
  frictionWinner: 'a' | 'b' | 'tie' | 'unknown';
  frictionPctChange: number | null; // |delta|/A * 100
  metrics: MetricDelta[];
  insights: string[];
  overallWinner: 'a' | 'b' | 'tie' | 'unknown';
}

function pickWinner(a: number, b: number, higherIsBetter: boolean): 'a' | 'b' | 'tie' {
  if (Math.abs(a - b) < 0.05) return 'tie';
  if (higherIsBetter) return a > b ? 'a' : 'b';
  return a < b ? 'a' : 'b';
}

export function compareJobs(jobA: Job, jobB: Job): CompareResult {
  const frictionA = jobA.friction_score ?? null;
  const frictionB = jobB.friction_score ?? null;

  let frictionDelta: number | null = null;
  let frictionPctChange: number | null = null;
  let frictionWinner: CompareResult['frictionWinner'] = 'unknown';

  if (frictionA != null && frictionB != null) {
    frictionDelta = frictionB - frictionA;
    frictionPctChange = frictionA === 0 ? 0 : (Math.abs(frictionDelta) / frictionA) * 100;
    if (Math.abs(frictionDelta) < 0.1) frictionWinner = 'tie';
    // Lower friction score is better
    else frictionWinner = frictionB < frictionA ? 'b' : 'a';
  }

  const metrics: MetricDelta[] = [];
  const keys: MetricKey[] = [
    'visual_processing',
    'object_recognition',
    'reading_language',
    'attention_salience',
    'cognitive_load',
    'emotional_response',
  ];

  for (const key of keys) {
    const a = jobA.z_scores?.[key];
    const b = jobB.z_scores?.[key];
    if (a == null || b == null) continue;
    const higherIsBetter = HIGHER_IS_BETTER[key];
    metrics.push({
      key,
      label: METRIC_LABELS[key],
      valA: a,
      valB: b,
      delta: b - a,
      winner: pickWinner(a, b, higherIsBetter),
      higherIsBetter,
    });
  }

  // Insights — highlight the top 3 most meaningful deltas.
  const insights: string[] = [];
  const sorted = [...metrics].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  for (const m of sorted.slice(0, 3)) {
    if (Math.abs(m.delta) < 0.25) continue;
    const direction = m.delta > 0 ? 'up' : 'down';
    const magnitude = Math.abs(m.delta).toFixed(2);
    const winnerName = m.winner === 'a' ? 'Version A' : m.winner === 'b' ? 'Version B' : null;
    if (!winnerName) continue;
    const good = (m.winner === 'b' && m.delta < 0 && !m.higherIsBetter)
              || (m.winner === 'b' && m.delta > 0 && m.higherIsBetter)
              || (m.winner === 'a' && m.delta > 0 && !m.higherIsBetter)
              || (m.winner === 'a' && m.delta < 0 && m.higherIsBetter);
    const verb = m.higherIsBetter
      ? (m.delta > 0 ? 'strengthened' : 'weakened')
      : (m.delta > 0 ? 'heavier' : 'lighter');
    insights.push(
      `${m.label} ${verb} by ${magnitude}σ (${direction} in B) — ${good ? winnerName : winnerName} ${good ? 'wins' : 'takes the hit'}.`
    );
  }
  if (insights.length === 0) {
    insights.push('Both versions score within a rounding error of each other across all metrics.');
  }

  // Overall winner — friction score is the north star, fall back to metric count if tied.
  let overallWinner: CompareResult['overallWinner'] = 'unknown';
  if (frictionWinner === 'a' || frictionWinner === 'b') {
    overallWinner = frictionWinner;
  } else if (frictionWinner === 'tie') {
    // Count metric wins
    let aWins = 0, bWins = 0;
    for (const m of metrics) {
      if (m.winner === 'a') aWins++;
      else if (m.winner === 'b') bWins++;
    }
    if (aWins > bWins) overallWinner = 'a';
    else if (bWins > aWins) overallWinner = 'b';
    else overallWinner = 'tie';
  }

  return {
    frictionA,
    frictionB,
    frictionDelta,
    frictionWinner,
    frictionPctChange,
    metrics,
    insights,
    overallWinner,
  };
}
