'use client';

import { useCallback, useEffect, useState } from 'react';
import { frictionTone } from '@/lib/frictionTone';
import { getProject, deleteRun, type ProjectDetail, type Run } from '@/lib/projects';

interface Props {
  projectId: string;
  onOpenRun: (run: Run) => void;
  onBack: () => void;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ProjectView({ projectId, onOpenRun, onBack }: Props) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await getProject(projectId);
      setProject(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const removeRun = async (run: Run) => {
    if (!confirm(`Delete run "${run.label || run.file_name}"?`)) return;
    try {
      await deleteRun(run.id);
      await reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="project-view view-enter">
      <div className="project-view-header">
        <button type="button" className="project-view-back" onClick={onBack}>
          ← Back
        </button>
        {project && (
          <div className="project-view-title-block">
            <h2 className="project-view-title">{project.name}</h2>
            {project.description && (
              <p className="project-view-desc">{project.description}</p>
            )}
            <div className="project-view-meta">
              <span>{project.run_count ?? project.runs.length} run{(project.run_count ?? project.runs.length) === 1 ? '' : 's'}</span>
              {project.best_friction_score != null && (
                <span>Best friction: {project.best_friction_score.toFixed(1)}</span>
              )}
              <span>Created {fmtDate(project.created_at)}</span>
            </div>
          </div>
        )}
      </div>

      {loading && <div className="project-view-empty">Loading…</div>}
      {error && <div className="project-view-error">{error}</div>}

      {project && project.runs.length === 0 && !loading && (
        <div className="project-view-empty">
          No runs in this project yet. Upload something while this project is
          selected to see it ranked here.
        </div>
      )}

      {project && project.runs.length > 0 && (
        <div className="project-view-table" role="table" aria-label={`Runs in ${project.name}`}>
          <div className="project-view-row project-view-row--head" role="row">
            <span className="project-view-col project-view-col--rank">Rank</span>
            <span className="project-view-col project-view-col--name">Version</span>
            <span className="project-view-col project-view-col--score">Friction</span>
            <span className="project-view-col project-view-col--date">Created</span>
            <span className="project-view-col project-view-col--actions" aria-hidden />
          </div>
          {project.runs.map((run, idx) => {
            const tone = frictionTone(run.friction_score);
            return (
              <div key={run.id} className="project-view-row" role="row">
                <span className="project-view-col project-view-col--rank">#{idx + 1}</span>
                <button
                  type="button"
                  className="project-view-col project-view-col--name project-view-col--clickable"
                  onClick={() => onOpenRun(run)}
                  title={`Open ${run.label || run.file_name}`}
                >
                  <span className="project-view-run-name">{run.label || run.file_name}</span>
                  {run.note && <span className="project-view-run-note">{run.note}</span>}
                </button>
                <span className={`project-view-col project-view-col--score project-view-score--${tone}`}>
                  {run.friction_score != null ? run.friction_score.toFixed(1) : '—'}
                </span>
                <span className="project-view-col project-view-col--date">
                  {fmtDate(run.created_at)}
                </span>
                <span className="project-view-col project-view-col--actions">
                  <button
                    type="button"
                    className="project-view-action project-view-action--danger"
                    onClick={() => void removeRun(run)}
                    title="Delete this run"
                    aria-label={`Delete ${run.label || run.file_name}`}
                  >
                    ×
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
