'use client';

import { frictionTone } from '@/lib/frictionTone';
import type { Run } from '@/lib/projects';

interface Props {
  projectName: string;
  runs: Run[];
  currentJobId: string;
  onOpenRun?: (run: Run) => void;
}

export default function ProjectRankCard({
  projectName,
  runs,
  currentJobId,
  onOpenRun,
}: Props) {
  // Sort by friction score ascending (best first), nulls at the end.
  const ranked = [...runs].sort((a, b) => {
    const as = a.friction_score;
    const bs = b.friction_score;
    if (as == null && bs == null) return 0;
    if (as == null) return 1;
    if (bs == null) return -1;
    return as - bs;
  });

  const total = ranked.length;
  const current = ranked.find(r => r.job_id === currentJobId);
  const rank = current ? ranked.indexOf(current) + 1 : null;
  const best = ranked[0];
  const isBest = !!current && !!best && current.job_id === best.job_id;

  if (total === 0) return null;

  return (
    <aside className="project-rank-card" aria-label={`Ranking in ${projectName}`}>
      <div className="project-rank-card-head">
        <span className="project-rank-card-eyebrow">Project</span>
        <span className="project-rank-card-project">{projectName}</span>
      </div>
      <div className="project-rank-card-body">
        {rank != null ? (
          <div className="project-rank-card-summary">
            <span className="project-rank-card-rank">
              Rank <strong>{rank}</strong> of {total}
            </span>
            {isBest && total > 1 && (
              <span className="project-rank-card-best">★ best friction score so far</span>
            )}
          </div>
        ) : (
          <div className="project-rank-card-summary">
            <span className="project-rank-card-rank">
              {total} run{total === 1 ? '' : 's'} in this project
            </span>
          </div>
        )}
        <ol className="project-rank-card-list">
          {ranked.slice(0, 5).map((run, idx) => {
            const tone = frictionTone(run.friction_score);
            const isCurrent = run.job_id === currentJobId;
            return (
              <li
                key={run.id || run.job_id}
                className={`project-rank-row${isCurrent ? ' is-current' : ''}`}
              >
                <span className="project-rank-row-idx">{idx + 1}</span>
                <button
                  type="button"
                  className="project-rank-row-name"
                  disabled={!onOpenRun || isCurrent}
                  onClick={() => onOpenRun && !isCurrent && onOpenRun(run)}
                  title={run.label || run.file_name}
                >
                  {run.label || run.file_name}
                </button>
                {run.friction_score != null ? (
                  <span className={`project-rank-row-score project-rank-row-score--${tone}`}>
                    {run.friction_score.toFixed(1)}
                  </span>
                ) : (
                  <span className="project-rank-row-score project-rank-row-score--dim">—</span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}
