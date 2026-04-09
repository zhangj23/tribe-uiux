'use client';

import type { ZScores } from '@/types';

interface Step {
  label: string;
  detail: string;
  tone: 'phosphor' | 'amber' | 'red' | 'cyan';
  /** Signed z-score magnitude that triggered this step. Omit for fallback nudges. */
  z?: number;
  /** Short tag like "cognitive_load". Omit for fallback nudges. */
  metric?: string;
  /** Sort key — higher = more urgent — used to rank which steps survive the top-3 cut. */
  weight: number;
}

/**
 * Derive concrete, actionable next steps from the z-scores.
 * We flag anything that is meaningfully above or below baseline and
 * translate it into marketer-facing guidance.
 */
function stepsFromZ(z: ZScores | undefined, friction: number | undefined): Step[] {
  // If we have no z-scores at all, fall back to a friction-score only nudge.
  if (!z) {
    if (friction != null && friction <= 4) {
      return [{
        label: 'Looking solid',
        detail: 'Friction score is in the green zone. Consider testing a bolder variant to find the ceiling.',
        tone: 'phosphor',
        weight: 0,
      }];
    }
    if (friction != null && friction >= 7) {
      return [{
        label: 'Heavy friction detected',
        detail: 'Score is trending high. Strip competing elements and simplify the focal hierarchy before iterating.',
        tone: 'red',
        weight: 10,
      }];
    }
    return [{
      label: 'Iterate and retest',
      detail: 'Try one variable change at a time (copy, color, framing) and compare runs side-by-side.',
      tone: 'cyan',
      weight: 0,
    }];
  }
  const steps: Step[] = [];

  if (z.cognitive_load > 1.5) {
    steps.push({
      label: 'Cut cognitive load',
      detail:
        'The parsing cost is running hot — strip one secondary element (logo, subline, stock texture) and retest.',
      tone: 'red',
      z: z.cognitive_load,
      metric: 'cognitive_load',
      weight: Math.abs(z.cognitive_load),
    });
  }

  if (z.attention_salience < -0.5) {
    steps.push({
      label: 'Add a stronger hook',
      detail:
        'Nothing is pulling the salience network. Push contrast on the focal element or introduce a single bright accent color.',
      tone: 'amber',
      z: z.attention_salience,
      metric: 'attention_salience',
      weight: Math.abs(z.attention_salience),
    });
  } else if (z.attention_salience > 1.5) {
    steps.push({
      label: 'Anchor the hook',
      detail:
        'Salience is strong — but make sure it points to your CTA. Align the eye-path from attention grabber to action.',
      tone: 'cyan',
      z: z.attention_salience,
      metric: 'attention_salience',
      weight: Math.abs(z.attention_salience) * 0.6,
    });
  }

  if (z.reading_language > 1.2) {
    steps.push({
      label: 'Shorten the copy',
      detail:
        'Reading circuits are burning. Halve your body copy or move it out of the main visual area.',
      tone: 'amber',
      z: z.reading_language,
      metric: 'reading_language',
      weight: Math.abs(z.reading_language),
    });
  }

  if (z.emotional_response < -0.5) {
    steps.push({
      label: 'Raise emotional stakes',
      detail:
        'Limbic response is flat. Consider a human face, a color-of-emotion shift, or a story beat to wake up affect.',
      tone: 'amber',
      z: z.emotional_response,
      metric: 'emotional_response',
      weight: Math.abs(z.emotional_response),
    });
  }

  if (z.visual_processing < -0.5 && z.object_recognition < -0.5) {
    const avg = (z.visual_processing + z.object_recognition) / 2;
    steps.push({
      label: 'Strengthen the subject',
      detail:
        'Visual + object pathways are both quiet — the hero element may be getting lost. Increase size, contrast, or isolation.',
      tone: 'amber',
      z: avg,
      metric: 'visual_processing',
      weight: Math.abs(avg),
    });
  }

  // If nothing obvious and the creative looks healthy, give a forward-leaning nudge.
  if (steps.length === 0) {
    if (friction != null && friction <= 4) {
      steps.push({
        label: 'Push harder next round',
        detail:
          "You're in the green zone. Test a bolder variant — stronger emotional cue or tighter copy — to find the ceiling.",
        tone: 'phosphor',
        weight: 0,
      });
    } else {
      steps.push({
        label: 'Iterate and retest',
        detail:
          'No single metric is flashing. Tweak one variable (color, copy, framing) at a time and compare runs.',
        tone: 'cyan',
        weight: 0,
      });
    }
  }

  // Rank by urgency (biggest z magnitude first) then keep the top 3.
  return steps.sort((a, b) => b.weight - a.weight).slice(0, 3);
}

function magnitudeLabel(z: number): string {
  const abs = Math.abs(z);
  const sign = z > 0 ? '+' : '−';
  return `${sign}${abs.toFixed(1)}σ`;
}

function severityFor(z: number): 'critical' | 'strong' | 'mild' {
  const abs = Math.abs(z);
  if (abs >= 2) return 'critical';
  if (abs >= 1) return 'strong';
  return 'mild';
}

interface Props {
  zScores?: ZScores;
  frictionScore?: number;
}

export default function NextSteps({ zScores, frictionScore }: Props) {
  const steps = stepsFromZ(zScores, frictionScore);
  if (steps.length === 0) return null;

  return (
    <div className="next-steps">
      <div className="next-steps-header">
        <span className="next-steps-eyebrow">What to change next</span>
        <span className="next-steps-meta">Ranked by z-score magnitude</span>
      </div>
      <ol className="next-steps-list">
        {steps.map((step, i) => (
          <li key={i} className={`next-step next-step--${step.tone}`}>
            <span className="next-step-index">{String(i + 1).padStart(2, '0')}</span>
            <div className="next-step-body">
              <div className="next-step-title-row">
                <span className="next-step-label">{step.label}</span>
                {step.z != null && (
                  <span
                    className={`next-step-severity next-step-severity--${severityFor(step.z)}`}
                    title={`z-score magnitude: ${magnitudeLabel(step.z)}`}
                  >
                    {magnitudeLabel(step.z)}
                  </span>
                )}
              </div>
              <p className="next-step-detail">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
