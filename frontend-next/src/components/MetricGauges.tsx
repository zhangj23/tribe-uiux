import type { ZScores } from '@/types';

type LabelFn = (tier: 'low' | 'normal' | 'elevated' | 'extreme') => string;

const METRIC_CONFIG: {
  key: keyof ZScores;
  label: string;
  tooltip: string;
  verdict: LabelFn;
}[] = [
  {
    key: 'visual_processing',
    label: 'Visual Processing',
    tooltip: 'How strongly visual cortex regions respond to your creative.',
    verdict: t => ({
      low: 'Weak hold',
      normal: 'Steady',
      elevated: 'Strong visual hold',
      extreme: 'Visual overdrive',
    }[t]),
  },
  {
    key: 'object_recognition',
    label: 'Object / Face Recognition',
    tooltip: 'Engagement of object and face recognition pathways.',
    verdict: t => ({
      low: 'Faces fade out',
      normal: 'Recognizable',
      elevated: 'Face-led focus',
      extreme: 'Dominant subject',
    }[t]),
  },
  {
    key: 'reading_language',
    label: 'Reading & Language',
    tooltip: 'How much of the brain goes into decoding text.',
    verdict: t => ({
      low: 'Minimal reading',
      normal: 'Comfortable copy',
      elevated: 'Copy-heavy',
      extreme: 'Text overload',
    }[t]),
  },
  {
    key: 'attention_salience',
    label: 'Attention & Salience',
    tooltip: 'Salience network engagement — does anything pop?',
    verdict: t => ({
      low: 'Nothing pops',
      normal: 'Comfortable pull',
      elevated: 'Strong hook',
      extreme: 'Scream test',
    }[t]),
  },
  {
    key: 'cognitive_load',
    label: 'Cognitive Load',
    tooltip: 'How much mental effort the brain spends parsing this.',
    verdict: t => ({
      low: 'Effortless',
      normal: 'Healthy',
      elevated: 'Getting busy',
      extreme: 'Overload — simplify',
    }[t]),
  },
  {
    key: 'emotional_response',
    label: 'Emotional Response',
    tooltip: 'Limbic / emotional circuit engagement.',
    verdict: t => ({
      low: 'Flat affect',
      normal: 'Warm',
      elevated: 'Strong feeling',
      extreme: 'Intense reaction',
    }[t]),
  },
];

function tier(z: number): 'low' | 'normal' | 'elevated' | 'extreme' {
  if (z < -1) return 'low';
  if (z < 1)  return 'normal';
  if (z < 2)  return 'elevated';
  return 'extreme';
}

interface Props { zScores: ZScores; }

export default function MetricGauges({ zScores }: Props) {
  return (
    <>
      {METRIC_CONFIG.map(({ key, label, tooltip, verdict }) => {
        const z = zScores[key] ?? 0;
        const t = tier(z);
        const verdictText = verdict(t);
        const signed = `${z >= 0 ? '+' : ''}${z.toFixed(2)}`;
        const barWidth = Math.min(100, Math.max(5, ((z + 3) / 6) * 100));
        return (
          <div
            key={key}
            className={`gauge gauge--${t}`}
            title={tooltip}
            role="group"
            aria-label={`${label}: ${signed} z-score, ${verdictText}. ${tooltip}`}
          >
            <div className="gauge-header">
              <span className="gauge-name">{label}</span>
              <span className="gauge-zscore">{signed}</span>
            </div>
            <div className="gauge-bar-track">
              <div className="gauge-bar-fill" style={{ width: `${barWidth}%` }} />
            </div>
            <span className="gauge-interpretation">{verdictText}</span>
          </div>
        );
      })}
    </>
  );
}
