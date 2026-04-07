'use client';

import { useEffect, useRef } from 'react';
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip,
  Filler,
  type ChartConfiguration,
} from 'chart.js';
import type { Timeseries } from '@/types';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip, Filler);

const METRIC_CONFIG = [
  { key: 'visual_processing',  label: 'Visual Processing',        color: '#00d4ff' },
  { key: 'object_recognition', label: 'Object/Face Recognition',  color: '#7c6aff' },
  { key: 'reading_language',   label: 'Reading & Language',       color: '#39ff85' },
  { key: 'attention_salience', label: 'Attention & Salience',     color: '#ffb347' },
  { key: 'cognitive_load',     label: 'Cognitive Load',           color: '#ff4d6a' },
  { key: 'emotional_response', label: 'Emotional Response',       color: '#ff85c8' },
] as const;

interface Props {
  timeseries: Timeseries;
  timestamps: number[];
}

export default function TimeseriesChart({ timeseries, timestamps }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const labels = timestamps.map(t => t.toFixed(1) + 's');
    const datasets = METRIC_CONFIG.map(({ key, label, color }) => ({
      label,
      data: timeseries[key] ?? [],
      borderColor: color,
      backgroundColor: color + '15',
      borderWidth: 1.5,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.4,
      fill: false,
    }));

    const config: ChartConfiguration = {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              color: '#8b90a0',
              font: { family: '"DM Mono", monospace', size: 10 },
              boxWidth: 12,
              boxHeight: 2,
              padding: 12,
              usePointStyle: false,
            },
          },
          tooltip: {
            backgroundColor: '#191c25',
            titleColor: '#e8eaf0',
            bodyColor: '#8b90a0',
            borderColor: '#2a2f3e',
            borderWidth: 1,
            titleFont: { family: '"DM Mono", monospace', size: 11 },
            bodyFont: { family: '"DM Mono", monospace', size: 10 },
            padding: 10,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
          },
        },
        scales: {
          x: {
            grid: { color: '#1e2130' },
            ticks: { color: '#4a4f62', font: { family: '"DM Mono", monospace', size: 9 }, maxTicksLimit: 10 },
            title: { display: true, text: 'Time (s)', color: '#4a4f62', font: { family: '"DM Mono", monospace', size: 10 } },
          },
          y: {
            grid: { color: '#1e2130' },
            ticks: { color: '#4a4f62', font: { family: '"DM Mono", monospace', size: 9 } },
            title: { display: true, text: 'Activation', color: '#4a4f62', font: { family: '"DM Mono", monospace', size: 10 } },
          },
        },
      },
    };

    chartRef.current = new Chart(canvas, config);
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [timeseries, timestamps]);

  return <canvas ref={canvasRef} style={{ width: '100%' }} />;
}
