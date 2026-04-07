interface Props { score?: number; }

export default function FrictionScore({ score }: Props) {
  let color = 'var(--text-dim)';
  if (score != null) {
    if (score <= 3) color = 'var(--phosphor)';
    else if (score <= 5) color = 'var(--cyan)';
    else if (score <= 7) color = 'var(--amber)';
    else color = 'var(--red)';
  }

  return (
    <div className="friction-score-display">
      <div className="friction-number" style={{ color }}>
        {score != null ? score.toFixed(1) : '--'}
      </div>
      <div className="friction-label">Friction Score</div>
      <div className="friction-scale">
        <span>1</span>
        <div className="friction-bar">
          <div
            className="friction-fill"
            style={{
              width: score != null ? `${(score / 10) * 100}%` : '0%',
              background: color,
            }}
          />
        </div>
        <span>10</span>
      </div>
    </div>
  );
}
