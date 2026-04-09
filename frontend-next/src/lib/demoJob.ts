import type { Job } from '@/types';

/**
 * Build a synthetic but plausible Job that we can drop into the results view
 * for a first-time visitor who hasn't uploaded anything yet. The numbers are
 * hand-tuned so the friction score lands in the moderate range, the spike
 * timeline has visible peaks, and NextSteps surfaces a meaningful action.
 */
export function makeDemoJob(): Job {
  const timestamps: number[] = [];
  const cogLoad: number[] = [];
  const reading: number[] = [];
  const attention: number[] = [];
  const visual: number[] = [];
  const objects: number[] = [];
  const emotional: number[] = [];

  // 30 frames over ~12 seconds with deliberate spike shapes per metric
  for (let i = 0; i < 30; i++) {
    const t = (i / 29) * 12;
    timestamps.push(Number(t.toFixed(2)));
    // Cognitive load rises hard around 8s — that's our hot moment
    cogLoad.push(0.4 + 1.6 * Math.exp(-Math.pow((t - 8) / 1.5, 2)));
    // Reading load gentle plateau
    reading.push(0.6 + 0.3 * Math.sin(t * 0.4));
    // Attention spike at 3s
    attention.push(0.5 + 1.4 * Math.exp(-Math.pow((t - 3) / 1.3, 2)));
    // Visual processing dips in the middle
    visual.push(0.9 - 0.4 * Math.exp(-Math.pow((t - 6) / 2.2, 2)));
    // Object recognition rides with attention
    objects.push(0.7 + 1.0 * Math.exp(-Math.pow((t - 3.4) / 1.8, 2)));
    // Emotional response slow build to a peak near the end
    emotional.push(0.4 + 0.9 * Math.exp(-Math.pow((t - 10.5) / 2.0, 2)));
  }

  return {
    job_id: 'demo-tribe-sample',
    status: 'completed',
    progress: 1,
    friction_score: 5.4,
    z_scores: {
      visual_processing: 0.42,
      object_recognition: 1.18,
      reading_language: 0.9,
      attention_salience: 1.84,
      cognitive_load: 1.92,
      emotional_response: 0.31,
    },
    timestamps,
    timeseries: {
      visual_processing: visual,
      object_recognition: objects,
      reading_language: reading,
      attention_salience: attention,
      cognitive_load: cogLoad,
      emotional_response: emotional,
    },
    llm_analysis: `## Headline read

This sample creative pulls strong attention early — the salience network
spikes within the first three seconds, which is exactly where you want a
product hero to land.

**However**, cognitive load climbs sharply around the eight-second mark.
That's a tell-tale sign of a competing element appearing right when the
viewer is trying to lock onto your message.

## What's working

- **Strong subject hold** — object recognition pathways stay engaged
  throughout the run, suggesting the focal element is well-defined.
- **Hookable opener** — the attention spike at 3s is the kind of pull
  marketers chase. Lean into it on iterations.

## What needs attention

- The cognitive-load spike at 8s lines up with the timeseries dip in
  visual processing. Whatever change you made to the composition
  there is asking too much of the viewer.
- Emotional response builds late instead of seeding early. A human
  face or color shift in the first half would warm the affect curve.

## Suggested next iteration

Strip one element from the 8-second region (an extra logo, a stock
texture, a secondary CTA) and re-test. If the cognitive-load spike
flattens out, you'll see the friction score drop into the green
zone without losing the strong opening hook.`,
  };
}
