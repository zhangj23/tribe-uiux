/**
 * Chart.js metric visualizations — timeseries and gauges.
 */
const Charts = (() => {
  let timeseriesChart = null;
  let chartJsLoaded = false;
  let chartJsLoading = null;

  function loadChartJs() {
    if (chartJsLoaded) return Promise.resolve();
    if (chartJsLoading) return chartJsLoading;
    chartJsLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';
      script.onload = () => { chartJsLoaded = true; resolve(); };
      script.onerror = () => reject(new Error('Failed to load Chart.js'));
      document.head.appendChild(script);
    });
    return chartJsLoading;
  }

  const METRIC_CONFIG = {
    visual_processing: { label: 'Visual Processing', color: '#00d4ff' },
    object_recognition: { label: 'Object/Face Recognition', color: '#7c6aff' },
    reading_language: { label: 'Reading & Language', color: '#39ff85' },
    attention_salience: { label: 'Attention & Salience', color: '#ffb347' },
    cognitive_load: { label: 'Cognitive Load', color: '#ff4d6a' },
    emotional_response: { label: 'Emotional Response', color: '#ff85c8' },
  };

  function renderGauges(zScores) {
    const grid = document.getElementById('gaugesGrid');
    grid.innerHTML = '';

    for (const [key, config] of Object.entries(METRIC_CONFIG)) {
      const z = zScores[key] || 0;
      const interp = interpretZ(z);
      const gauge = createGauge(config.label, z, interp);
      grid.appendChild(gauge);
    }
  }

  function createGauge(label, zScore, interpretation) {
    const el = document.createElement('div');
    el.className = `gauge gauge--${interpretation}`;

    // Map z-score to bar width (centered at 50%, range -3 to +3)
    const barWidth = Math.min(100, Math.max(5, ((zScore + 3) / 6) * 100));

    el.innerHTML = `
      <div class="gauge-header">
        <span class="gauge-name">${label}</span>
        <span class="gauge-zscore">${zScore >= 0 ? '+' : ''}${zScore.toFixed(2)}</span>
      </div>
      <div class="gauge-bar-track">
        <div class="gauge-bar-fill" style="width: ${barWidth}%"></div>
      </div>
      <span class="gauge-interpretation">${interpretation}</span>
    `;

    return el;
  }

  async function renderTimeseries(timeseries, timestamps) {
    const ctx = document.getElementById('timeseriesChart');
    if (!ctx) return;

    await loadChartJs();

    // Destroy previous chart
    if (timeseriesChart) {
      timeseriesChart.destroy();
    }

    const datasets = [];
    for (const [key, config] of Object.entries(METRIC_CONFIG)) {
      const data = timeseries[key] || [];
      datasets.push({
        label: config.label,
        data: data,
        borderColor: config.color,
        backgroundColor: config.color + '15',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.4,
        fill: false,
      });
    }

    const labels = timestamps.map(t => t.toFixed(1) + 's');

    timeseriesChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
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
            borderColor: '#363b4f',
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
            grid: { color: '#1e2130', lineWidth: 0.5 },
            ticks: {
              color: '#7d839c',
              font: { family: '"DM Mono", monospace', size: 9 },
              maxTicksLimit: 10,
            },
            title: {
              display: true,
              text: 'Time (s)',
              color: '#7d839c',
              font: { family: '"DM Mono", monospace', size: 10 },
            },
          },
          y: {
            grid: { color: '#1e2130', lineWidth: 0.5 },
            ticks: {
              color: '#7d839c',
              font: { family: '"DM Mono", monospace', size: 9 },
            },
            title: {
              display: true,
              text: 'Activation',
              color: '#7d839c',
              font: { family: '"DM Mono", monospace', size: 10 },
            },
          },
        },
      },
    });
  }

  function interpretZ(z) {
    if (z < -1) return 'low';
    if (z < 1) return 'normal';
    if (z < 2) return 'elevated';
    return 'extreme';
  }

  return { renderGauges, renderTimeseries };
})();
