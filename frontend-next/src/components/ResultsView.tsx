'use client';

import { useState } from 'react';
import BrainCanvas from './BrainCanvas';
import MetricGauges from './MetricGauges';
import TimeseriesChart from './TimeseriesChart';
import FrictionScore from './FrictionScore';
import AnalysisText from './AnalysisText';
import NextSteps from './NextSteps';
import SpikeTimeline from './SpikeTimeline';
import ExportButton from './ExportButton';
import type { Job } from '@/types';

interface Props {
  jobData: Job;
  onNewAnalysis: () => void;
}

export default function ResultsView({ jobData, onNewAnalysis }: Props) {
  const [timestep, setTimestep] = useState(0);
  const [compact, setCompact] = useState(false);
  const maxStep = Math.max(0, (jobData.brain_activations?.length ?? 1) - 1);
  const currentTime = jobData.timestamps?.[timestep];

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
            title={compact ? 'Switch to full detail view' : 'Switch to compact presentation view'}
          >
            {compact ? 'Full view' : 'Compact view'}
          </button>
          <ExportButton job={jobData} />
          <button className="btn-new" onClick={onNewAnalysis}>+ New Analysis</button>
        </div>
      </div>

      {/* Hero: Friction Score + Next Steps */}
      <section className="results-hero">
        <div className="results-hero-score">
          <FrictionScore score={jobData.friction_score} />
        </div>
        <div className="results-hero-actions">
          <NextSteps zScores={jobData.z_scores} frictionScore={jobData.friction_score} />
        </div>
      </section>

      <SpikeTimeline timeseries={jobData.timeseries} timestamps={jobData.timestamps} />

      {!compact && (
        <div className="results-grid">
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

          {/* Right: Analysis panel */}
          <div className="panel panel--analysis">
            <div className="panel-header">
              <h3>AI Analysis</h3>
              <span className="panel-badge">Claude</span>
            </div>
            <AnalysisText text={jobData.llm_analysis} />
          </div>
        </div>
      )}
    </div>
  );
}
