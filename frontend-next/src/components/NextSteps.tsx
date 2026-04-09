'use client';

import type { ZScores } from '@/types';

interface Step {
  label: string;
  detail: string;
  tone: 'phosphor' | 'amber' | 'red' | 'cyan';
}

/**
 * Derive concrete, actionable next steps from the z-scores.
 * We flag anything that is meaningfully above or below baseline and
 * translate it into marketer-facing guidance.
 */
function stepsFromZ(z: ZScores | undefined, friction: number | undefined): Step[] {
  if (!z) return [];
  const steps: Step[] = [];

  if (z.cognitive_load > 1.5) {
    steps.push({
      label: 'Cut cognitive load',
      detail:
        'The parsing cost is running hot — strip one secondary element (logo, subline, stock texture) and retest.',
      tone: 'red',
    });
  }

  if (z.attention_salience < -0.5) {
    steps.push({
      label: 'Add a stronger hook',
      detail:
        'Nothing is pulling the salience network. Push contrast on the focal element or introduce a single bright accent color.',
      tone: 'amber',
    });
  } else if (z.attention_salience > 1.5) {
    steps.push({
      label: 'Anchor the hook',
      detail:
        'Salience is strong — but make sure it points to your CTA. Align the eye-path from attention grabber to action.',
      tone: 'cyan',
    });
  }

  if (z.reading_language > 1.2) {
    steps.push({
      label: 'Shorten the copy',
      detail:
        'Reading circuits are burning. Halve your body copy or move it out of the main visual area.',
      tone: 'amber',
    });
  }

  if (z.emotional_response < -0.5) {
    steps.push({
      label: 'Raise emotional stakes',
      detail:
        'Limbic response is flat. Consider a human face, a color-of-emotion shift, or a story beat to wake up affect.',
      tone: 'amber',
    });
  }

  if (z.visual_processing < -0.5 && z.object_recognition < -0.5) {
    steps.push({
      label: 'Strengthen the subject',
      detail:
        'Visual + object pathways are both quiet — the hero element may be getting lost. Increase size, contrast, or isolation.',
      tone: 'amber',
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
      });
    } else {
      steps.push({
        label: 'Iterate and retest',
        detail:
          'No single metric is flashing. Tweak one variable (color, copy, framing) at a time and compare runs.',
        tone: 'cyan',
      });
    }
  }

  return steps.slice(0, 3);
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
        <span className="next-steps-meta">Derived from z-score deltas</span>
      </div>
      <ol className="next-steps-list">
        {steps.map((step, i) => (
          <li key={i} className={`next-step next-step--${step.tone}`}>
            <span className="next-step-index">{String(i + 1).padStart(2, '0')}</span>
            <div className="next-step-body">
              <span className="next-step-label">{step.label}</span>
              <p className="next-step-detail">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
