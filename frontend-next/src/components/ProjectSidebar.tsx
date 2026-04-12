'use client';

import { useState, FormEvent } from 'react';
import { frictionTone } from '@/lib/frictionTone';
import type { Project } from '@/lib/projects';

interface Props {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  onSelect: (project: Project | null) => void;
  onOpenProject: (project: Project) => void;
  onCreate: (name: string, description?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export default function ProjectSidebar({
  projects,
  currentProject,
  loading,
  onSelect,
  onOpenProject,
  onCreate,
  onDelete,
  onRename,
  collapsed,
  onToggleCollapsed,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(name, newDesc.trim() || undefined);
      setCreating(false);
      setNewName('');
      setNewDesc('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setBusy(false);
    }
  };

  const commitRename = async (id: string) => {
    const next = renameValue.trim();
    if (!next) {
      setRenameId(null);
      return;
    }
    try {
      await onRename(id, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rename failed');
    }
    setRenameId(null);
  };

  if (collapsed) {
    return (
      <aside className="project-sidebar project-sidebar--collapsed">
        <button
          type="button"
          className="project-sidebar-expand"
          onClick={onToggleCollapsed}
          aria-label="Expand project sidebar"
          title="Expand projects"
        >
          ›
        </button>
      </aside>
    );
  }

  return (
    <aside className="project-sidebar" aria-label="Projects">
      <div className="project-sidebar-header">
        <h3 className="project-sidebar-title">Projects</h3>
        {onToggleCollapsed && (
          <button
            type="button"
            className="project-sidebar-collapse"
            onClick={onToggleCollapsed}
            aria-label="Collapse project sidebar"
            title="Collapse"
          >
            ‹
          </button>
        )}
      </div>

      <div className="project-sidebar-body">
        <button
          type="button"
          className={`project-row project-row--unfiled${currentProject === null ? ' is-active' : ''}`}
          onClick={() => onSelect(null)}
        >
          <span className="project-row-name">All runs</span>
          <span className="project-row-meta">Unfiled</span>
        </button>

        {loading && projects.length === 0 && (
          <div className="project-sidebar-empty">Loading…</div>
        )}
        {!loading && projects.length === 0 && !creating && (
          <div className="project-sidebar-empty">
            No projects yet.<br />
            Create one to group related runs.
          </div>
        )}

        {projects.map(project => {
          const tone = frictionTone(project.best_friction_score ?? undefined);
          const isActive = currentProject?.id === project.id;
          const isRenaming = renameId === project.id;
          return (
            <div key={project.id} className={`project-row${isActive ? ' is-active' : ''}`}>
              {isRenaming ? (
                <input
                  className="project-row-rename"
                  value={renameValue}
                  autoFocus
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void commitRename(project.id);
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setRenameId(null);
                    }
                  }}
                  onBlur={() => void commitRename(project.id)}
                />
              ) : (
                <button
                  type="button"
                  className="project-row-main"
                  onClick={() => onSelect(project)}
                  onDoubleClick={() => onOpenProject(project)}
                  title="Click to set as current · Double-click to open"
                >
                  <span className="project-row-name">{project.name}</span>
                  <span className="project-row-meta">
                    {project.run_count ?? 0} run{(project.run_count ?? 0) === 1 ? '' : 's'}
                    {project.best_friction_score != null && (
                      <span className={`project-row-score project-row-score--${tone}`}>
                        {project.best_friction_score.toFixed(1)}
                      </span>
                    )}
                  </span>
                </button>
              )}
              {!isRenaming && (
                <div className="project-row-actions">
                  <button
                    type="button"
                    className="project-row-action"
                    title="Open project page"
                    onClick={() => onOpenProject(project)}
                    aria-label={`Open ${project.name}`}
                  >
                    ↗
                  </button>
                  <button
                    type="button"
                    className="project-row-action"
                    title="Rename"
                    onClick={() => {
                      setRenameId(project.id);
                      setRenameValue(project.name);
                    }}
                    aria-label={`Rename ${project.name}`}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="project-row-action project-row-action--danger"
                    title="Delete (runs will be unfiled)"
                    onClick={() => {
                      if (confirm(`Delete project "${project.name}"? Runs inside will be unfiled.`)) {
                        void onDelete(project.id);
                      }
                    }}
                    aria-label={`Delete ${project.name}`}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {creating ? (
          <form className="project-create-form" onSubmit={submitCreate}>
            <input
              className="project-create-name"
              placeholder="Project name"
              value={newName}
              autoFocus
              onChange={e => setNewName(e.target.value)}
              maxLength={120}
            />
            <input
              className="project-create-desc"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              maxLength={500}
            />
            {error && <div className="project-create-error">{error}</div>}
            <div className="project-create-actions">
              <button
                type="button"
                className="project-create-cancel"
                onClick={() => {
                  setCreating(false);
                  setError(null);
                  setNewName('');
                  setNewDesc('');
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" className="project-create-submit" disabled={busy || !newName.trim()}>
                {busy ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="project-create-btn"
            onClick={() => setCreating(true)}
          >
            + New project
          </button>
        )}
      </div>
    </aside>
  );
}
