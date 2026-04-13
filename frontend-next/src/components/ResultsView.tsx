'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import BrainCanvas from './BrainCanvas';
import MetricGauges from './MetricGauges';
import TimeseriesChart from './TimeseriesChart';
import FrictionScore from './FrictionScore';
import AnalysisText from './AnalysisText';
import NextSteps from './NextSteps';
import SpikeTimeline from './SpikeTimeline';
import ExportButton from './ExportButton';
import ProjectRankCard from './ProjectRankCard';
import { useHistory } from '@/hooks/useHistory';
import { listRuns, type Project, type Run } from '@/lib/projects';
import { useAuth } from '@/hooks/useAuth';
import type { Job } from '@/types';

interface Props {
  jobData: Job;
  onNewAnalysis: () => void;
  /** Optional context from a stored history entry — used to enrich exports. */
  entryLabel?: string;
  entryNote?: string;
  /** Send the user to upload view with this job pre-armed as Compare side A. */
  onCompareWith?: (jobId: string) => void;
  /** Project this run was filed under (shown as a rank card when set). */
  currentProject?: Project | null;
  /** Navigate to another run's results view (used by the rank card). */
  onOpenRun?: (run: Run) => void;
}

export default function ResultsView({
  jobData,
  onNewAnalysis,
  entryLabel,
  entryNote,
  onCompareWith,
  currentProject,
  onOpenRun,
}: Props) {
  const { user } = useAuth();
  const [projectRuns, setProjectRuns] = useState<Run[]>([]);
  const [timestep, setTimestep] = useState(0);
  const [compact, setCompact] = useState(false);
  const maxStep = Math.max(0, (jobData.brain_activations?.length ?? 1) - 1);
  const currentTime = jobData.timestamps?.[timestep];

  const { entries, setNote } = useHistory();

  // The current note (string) for THIS analysis. Starts from props but the
  // user can edit it inline; we mirror to localStorage as soon as the editor
  // commits.
  const [note, setLocalNote] = useState<string>(entryNote ?? '');
  const [editingNote, setEditingNote] = useState(false);
  const [draft, setDraft] = useState('');
  const noteJobIdRef = useRef<string | null>(null);

  // Keep local note in sync with the prop when the user navigates between
  // analyses (different job_id), but don't clobber typed-in changes.
  useEffect(() => {
    if (noteJobIdRef.current !== jobData.job_id) {
      setLocalNote(entryNote ?? '');
      setEditingNote(false);
      setDraft('');
      noteJobIdRef.current = jobData.job_id;
    }
  }, [jobData.job_id, entryNote]);

  // When a project is selected, fetch its runs so we can render the rank card.
  // Re-fetched whenever the current job id changes, because useHistory.record
  // has (fire-and-forget) just POSTed this run to the server — wait one tick
  // to catch it in the list.
  useEffect(() => {
    if (!user || !currentProject) {
      setProjectRuns([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const runs = await listRuns(currentProject.id);
        if (!cancelled) setProjectRuns(runs);
      } catch {
        if (!cancelled) setProjectRuns([]);
      }
    };
    void load();
    // Retry once after a short delay to pick up a fresh mirror POST.
    const t = setTimeout(() => void load(), 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [user, currentProject, jobData.job_id]);

  // Find the matching history entry by job id so we know if we can persist.
  const matchingEntry = entries.find(e => e.id === jobData.job_id);
  const canPersistNote = !!matchingEntry;
  const savedAt = matchingEntry?.savedAt;
  const whenText = (() => {
    const t = savedAt ?? Date.now();
    const d = new Date(t);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (sameDay) return `Today · ${time}`;
    const date = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
    return `${date} · ${time}`;
  })();
  // We can only seed Compare with this analysis if there's at least one *other*
  // entry to compare against. Otherwise the action would dead-end immediately.
  const canCompareWith = !!onCompareWith && !!matchingEntry &&
    entries.filter(e => e.id !== matchingEntry.id).length > 0;

  const startEditing = useCallback(() => {
    setDraft(note);
    setEditingNote(true);
  }, [note]);

  const cancelEditing = useCallback(() => {
    setEditingNote(false);
    setDraft('');
  }, []);

  const commitNote = useCallback(() => {
    if (matchingEntry) {
      setNote(matchingEntry.id, draft);
    }
    setLocalNote(draft.trim());
    setEditingNote(false);
    setDraft('');
  }, [matchingEntry, draft, setNote]);

  return (
    <div className={`view-enter${compact ? ' results--compact' : ''}`}>
      <div className="results-header">
        <span className="results-title">ANALYSIS COMPLETE</span>
        <div className="results-header-actions">
          <button
            type="button"
            className={`results-mode-toggle${compact ? ' is-active' : ''}`}
            onClick={() => setCompact(c => !c)}
            aria-pressed={compact}
            aria-label={compact ? 'Switch to full detail view' : 'Switch to compact presentation view'}
            title={compact ? 'Switch to full detail view' : 'Switch to compact presentation view'}
          >
            {compact ? 'Full view' : 'Compact view'}
          </button>
          {canCompareWith && (
            <button
              type="button"
              className="results-mode-toggle"
              onClick={() => onCompareWith && matchingEntry && onCompareWith(matchingEntry.id)}
              title="Compare this run against another from your history"
            >
              Compare with…
            </button>
          )}
          <ExportButton job={jobData} label={entryLabel} note={note} />
          <button className="btn-new" onClick={onNewAnalysis}>+ New Analysis</button>
        </div>
      </div>

      {/* Top row: Friction + timestamp | AI Summary | What to change next */}
      <section className="results-top">
        <div className="results-top-card results-top-card--score">
          <div className="results-hero-when" aria-label="When this analysis ran">
            <span className="results-hero-when-eyebrow">Analyzed</span>
            <span className="results-hero-when-value">{whenText}</span>
          </div>
          <FrictionScore score={jobData.friction_score} />
        </div>

        {jobData.llm_analysis && (
          <div className="results-top-card results-top-card--summary">
            <div className="panel-header">
              <h3>AI Summary</h3>
              <span className="panel-badge">Claude</span>
            </div>
            <AnalysisText text={jobData.llm_analysis} />
          </div>
        )}

        <div className="results-top-card results-top-card--next">
          <NextSteps zScores={jobData.z_scores} frictionScore={jobData.friction_score} />
        </div>
      </section>

      {currentProject && projectRuns.length > 0 && (
        <ProjectRankCard
          projectName={currentProject.name}
          runs={projectRuns}
          currentJobId={jobData.job_id}
          onOpenRun={onOpenRun}
        />
      )}

      {/* Inline note: existing preview, edit form, or "add" affordance. */}
      {(note || editingNote || canPersistNote) && (
        <aside
          className={`results-entry-note${editingNote ? ' is-editing' : ''}${!note && !editingNote ? ' is-empty' : ''}`}
          aria-label="Note for this analysis"
        >
          <span className="results-entry-note-eyebrow">Note</span>
          {editingNote ? (
            <div className="results-entry-note-edit">
              <textarea
                className="history-note-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { e.preventDefault(); cancelEditing(); }
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    commitNote();
                  }
                }}
                placeholder="Capture client feedback, version notes, or todos…"
                autoFocus
                rows={3}
                maxLength={500}
                aria-label="Note for this analysis"
              />
              <div className="history-note-actions">
                <span className="history-note-hint">⌘/Ctrl + Enter to save · Esc to cancel</span>
                <button type="button" className="history-clear" onClick={cancelEditing}>Cancel</button>
                <button
                  type="button"
                  className="history-compare-btn history-compare-btn--primary"
                  onClick={commitNote}
                >
                  Save
                </button>
              </div>
            </div>
          ) : note ? (
            <button
              type="button"
              className="results-entry-note-body results-entry-note-body--button"
              onClick={canPersistNote ? startEditing : undefined}
              disabled={!canPersistNote}
              title={canPersistNote ? 'Click to edit' : ''}
            >
              {note}
            </button>
          ) : (
            <button
              type="button"
              className="results-entry-note-add"
              onClick={startEditing}
            >
              + Add a note about this run
            </button>
          )}
        </aside>
      )}

      {!compact && (
        <section className="results-deep-dive">
          <div className="results-deep-dive-body">
            <SpikeTimeline timeseries={jobData.timeseries} timestamps={jobData.timestamps} />
            <div className="results-grid results-grid--split">
          {/* Left: Brain panel */}
          <div className="panel panel--brain">
            <div className="panel-header">
              <h3>Cortical Activation Map</h3>
              <span className="panel-badge">Destrieux Atlas</span>
            </div>
            <div className="brain-canvas-wrap">
              <BrainCanvas
                activations={jobData.brain_activations ?? []}
                timestep={timestep}
              />
            </div>
            {jobData.brain_activations && jobData.timestamps && (
              <div className="brain-controls">
                <label className="slider-label" htmlFor="timestep-slider">
                  <span>Timestep</span>
                  <span>{currentTime != null ? currentTime.toFixed(2) + 's' : '0.00s'}</span>
                </label>
                <input
                  id="timestep-slider"
                  type="range"
                  className="slider"
                  min={0}
                  max={maxStep}
                  value={timestep}
                  onChange={(e) => setTimestep(parseInt(e.target.value))}
                  aria-label="Scrub through analysis timesteps"
                />
              </div>
            )}
            <div className="brain-legend">
              <span>Low activation</span>
              <div className="legend-gradient" />
              <span>High activation</span>
            </div>
          </div>

          {/* Center: Metrics panel */}
          <div className="panel panel--metrics">
            <div className="panel-header">
              <h3>Neural Metrics</h3>
              <span className="panel-badge">Z-Scores</span>
            </div>
            <div className="gauges-grid">
              {jobData.z_scores && <MetricGauges zScores={jobData.z_scores} />}
            </div>
            <div className="chart-container">
              {jobData.timeseries && jobData.timestamps && (
                <TimeseriesChart
                  timeseries={jobData.timeseries}
                  timestamps={jobData.timestamps}
                />
              )}
            </div>
          </div>

            </div>
          </div>
        </section>
      )}
    </div>
  );
}
