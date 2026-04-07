'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import BrainCanvas from './BrainCanvas';
import MetricGauges from './MetricGauges';
import TimeseriesChart from './TimeseriesChart';
import FrictionScore from './FrictionScore';
import AnalysisText from './AnalysisText';
import type { Job } from '@/types';

const METRIC_KEYS = [
  { key: 'visual_processing', label: 'Visual' },
  { key: 'object_recognition', label: 'Object' },
  { key: 'reading_language', label: 'Language' },
  { key: 'attention_salience', label: 'Attention' },
  { key: 'cognitive_load', label: 'Cog Load' },
  { key: 'emotional_response', label: 'Emotion' },
];

interface Props {
  jobData: Job;
  onNewAnalysis: () => void;
}

export default function ResultsView({ jobData, onNewAnalysis }: Props) {
  const [timestep, setTimestep] = useState(0);
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [legendMin, setLegendMin] = useState(0);
  const [legendMax, setLegendMax] = useState(1);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxStep = Math.max(0, (jobData.brain_activations?.length ?? 1) - 1);
  const currentTime = jobData.timestamps?.[timestep];

  // Playback
  useEffect(() => {
    if (playing) {
      playRef.current = setInterval(() => {
        setTimestep(prev => (prev >= maxStep ? 0 : prev + 1));
      }, 500);
    } else if (playRef.current) {
      clearInterval(playRef.current);
      playRef.current = null;
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
  }, [playing, maxStep]);

  // Space key for play/pause
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        setPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleCopy = useCallback(() => {
    const text = jobData.llm_analysis || '';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [jobData.llm_analysis]);

  const handleLegendUpdate = useCallback((min: number, max: number) => {
    setLegendMin(min);
    setLegendMax(max);
  }, []);

  return (
    <div className="view-enter">
      <div className="results-header">
        <span className="results-title">ANALYSIS COMPLETE</span>
        <button className="btn-new" onClick={onNewAnalysis}>+ New Analysis</button>
      </div>

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
              activeMetric={activeMetric}
              onLegendUpdate={handleLegendUpdate}
            />
          </div>
          {jobData.brain_activations && jobData.timestamps && (
            <div className="brain-controls">
              <div className="slider-label">
                <span>Timestep</span>
                <span>{currentTime != null ? currentTime.toFixed(2) + 's' : '0.00s'}</span>
              </div>
              <div className="slider-row">
                <button
                  className="play-pause-btn"
                  onClick={() => setPlaying(p => !p)}
                  title="Play/Pause (Space)"
                >
                  {playing ? '\u23F8' : '\u25B6'}
                </button>
                <input
                  type="range"
                  className="slider"
                  min={0}
                  max={maxStep}
                  value={timestep}
                  onChange={(e) => setTimestep(parseInt(e.target.value))}
                />
              </div>
            </div>
          )}
          <div className="brain-legend">
            <span>Low <span className="legend-val">{legendMin.toFixed(3)}</span></span>
            <div className="legend-gradient" />
            <span>High <span className="legend-val">{legendMax.toFixed(3)}</span></span>
          </div>
          <div className="metric-toggles">
            <button
              className={`metric-toggle${activeMetric === null ? ' active' : ''}`}
              onClick={() => setActiveMetric(null)}
            >
              All
            </button>
            {METRIC_KEYS.map(m => (
              <button
                key={m.key}
                className={`metric-toggle${activeMetric === m.key ? ' active' : ''}`}
                onClick={() => setActiveMetric(activeMetric === m.key ? null : m.key)}
              >
                {m.label}
              </button>
            ))}
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
            <div className="panel-header-actions">
              <button
                className={`btn-copy${copied ? ' copied' : ''}`}
                onClick={handleCopy}
                title="Copy analysis text"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <span className="panel-badge">Claude</span>
            </div>
          </div>
          <FrictionScore score={jobData.friction_score} />
          <AnalysisText text={jobData.llm_analysis} />
        </div>
      </div>
    </div>
  );
}
