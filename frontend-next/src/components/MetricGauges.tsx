import type { ZScores } from '@/types';

const METRIC_CONFIG: { key: keyof ZScores; label: string }[] = [
  { key: 'visual_processing',  label: 'Visual Processing' },
  { key: 'object_recognition', label: 'Object/Face Recognition' },
  { key: 'reading_language',   label: 'Reading & Language' },
  { key: 'attention_salience', label: 'Attention & Salience' },
  { key: 'cognitive_load',     label: 'Cognitive Load' },
  { key: 'emotional_response', label: 'Emotional Response' },
];

function interpretZ(z: number): string {
  if (z < -1) return 'low';
  if (z < 1)  return 'normal';
  if (z < 2)  return 'elevated';
  return 'extreme';
}

interface Props { zScores: ZScores; }

export default function MetricGauges({ zScores }: Props) {
  return (
    <>
      {METRIC_CONFIG.map(({ key, label }) => {
        const z = zScores[key] ?? 0;
        const interp = interpretZ(z);
        const barWidth = Math.min(100, Math.max(5, ((z + 3) / 6) * 100));
        return (
          <div key={key} className={`gauge gauge--${interp}`}>
            <div className="gauge-header">
              <span className="gauge-name">{label}</span>
              <span className="gauge-zscore">{z >= 0 ? '+' : ''}{z.toFixed(2)}</span>
            </div>
            <div className="gauge-bar-track">
              <div className="gauge-bar-fill" style={{ width: `${barWidth}%` }} />
            </div>
            <span className="gauge-interpretation">{interp}</span>
          </div>
        );
      })}
    </>
  );
}
