interface Props { score?: number; }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function friction(score: number | undefined): {
  display: string;
  pct: number;
  color: string;
  verdict: string;
  hint: string;
} {
  if (score == null || Number.isNaN(score)) {
    return {
      display: '--',
      pct: 0,
      color: 'var(--text-dim)',
      verdict: 'Awaiting analysis',
      hint: '',
    };
  }

  const clamped = clamp(score, 1, 10);
  const pct = ((clamped - 1) / 9) * 100;

  let color = 'var(--phosphor)';
  let verdict = 'Low friction';
  let hint = 'Clear signal — users will process this easily.';

  if (clamped > 7) {
    color = 'var(--red)';
    verdict = 'High friction';
    hint = 'Overloaded. Simplify composition, reduce competing elements.';
  } else if (clamped > 5) {
    color = 'var(--amber)';
    verdict = 'Moderate friction';
    hint = 'Engaging but busy. Consider tightening focal hierarchy.';
  } else if (clamped > 3) {
    color = 'var(--cyan)';
    verdict = 'Healthy';
    hint = 'Clean, readable response. Room to push emotional hooks.';
  }

  return {
    display: clamped.toFixed(1),
    pct,
    color,
    verdict,
    hint,
  };
}

export default function FrictionScore({ score }: Props) {
  const { display, pct, color, verdict, hint } = friction(score);

  return (
    <div className="friction-score-display" role="group" aria-label="Friction score">
      <div className="friction-number" style={{ color }}>
        {display}
      </div>
      <div className="friction-label">Friction Score</div>
      <div className="friction-verdict" style={{ color }}>{verdict}</div>
      <div className="friction-scale">
        <span>1</span>
        <div className="friction-bar">
          <div
            className="friction-fill"
            style={{
              width: `${pct}%`,
              background: color,
            }}
          />
        </div>
        <span>10</span>
      </div>
      {hint && <p className="friction-hint">{hint}</p>}
    </div>
  );
}
