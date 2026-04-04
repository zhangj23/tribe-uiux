/**
 * Comparison mode — handles dual-file upload, parallel polling,
 * and side-by-side results rendering.
 */
const Compare = (() => {
  let fileB = null;
  let pollIntervalA = null;
  let pollIntervalB = null;
  let resultA = null;
  let resultB = null;
  let errorsA = 0;
  let errorsB = 0;

  const ALLOWED_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif',
    '.mp4', '.mov', '.avi', '.mkv', '.webm',
    '.mp3', '.wav', '.ogg', '.flac', '.m4a',
  ];
  const MAX_FILE_SIZE = 100 * 1024 * 1024;

  const METRIC_LABELS = {
    visual_processing: 'Visual Processing',
    object_recognition: 'Object Recognition',
    reading_language: 'Reading / Language',
    attention_salience: 'Attention / Salience',
    cognitive_load: 'Cognitive Load',
    emotional_response: 'Emotional Response',
  };

  function init() {
    const compareBtn = document.getElementById('compareBtn');
    const dropzoneB = document.getElementById('dropzoneB');
    const fileInputB = document.getElementById('fileInputB');
    const browseBtnB = document.getElementById('browseBtnB');
    const fileRemoveB = document.getElementById('fileRemoveB');
    const runCompareBtn = document.getElementById('runCompareBtn');
    const newCompareBtn = document.getElementById('newCompareBtn');

    compareBtn.addEventListener('click', showCompareSlot);

    dropzoneB.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzoneB.classList.add('drag-over');
    });
    dropzoneB.addEventListener('dragleave', () => dropzoneB.classList.remove('drag-over'));
    dropzoneB.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneB.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) selectFileB(e.dataTransfer.files[0]);
    });

    dropzoneB.addEventListener('click', (e) => {
      if (e.target !== browseBtnB) fileInputB.click();
    });
    browseBtnB.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInputB.click();
    });
    fileInputB.addEventListener('change', () => {
      if (fileInputB.files.length > 0) selectFileB(fileInputB.files[0]);
    });

    fileRemoveB.addEventListener('click', clearFileB);
    runCompareBtn.addEventListener('click', runComparison);
    newCompareBtn.addEventListener('click', () => App.showUpload());
  }

  function showCompareSlot() {
    document.getElementById('compareUpload').style.display = 'block';
    document.getElementById('compareBtn').style.display = 'none';
  }

  function showCompareError(message) {
    const errorEl = document.getElementById('compareError');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  function hideCompareError() {
    const errorEl = document.getElementById('compareError');
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
  }

  function isAllowedFile(file) {
    const name = file.name.toLowerCase();
    return ALLOWED_EXTENSIONS.some(ext => name.endsWith(ext));
  }

  function selectFileB(file) {
    hideCompareError();

    // Validate file type
    if (!isAllowedFile(file)) {
      showCompareError('Unsupported file type. Allowed: ' + ALLOWED_EXTENSIONS.join(', '));
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      showCompareError('File too large. Maximum size is 100 MB.');
      return;
    }

    fileB = file;
    document.getElementById('dropzoneB').style.display = 'none';
    const preview = document.getElementById('filePreviewB');
    preview.style.display = 'flex';
    document.getElementById('fileNameB').textContent = file.name;
    document.getElementById('fileSizeB').textContent = formatSize(file.size);

    if (file.type.startsWith('image/')) {
      document.getElementById('fileIconB').textContent = '\u{1F5BC}';
    } else if (file.type.startsWith('video/')) {
      document.getElementById('fileIconB').textContent = '\u{1F3AC}';
    } else {
      document.getElementById('fileIconB').textContent = '\u{1F3B5}';
    }

    document.getElementById('runCompareBtn').disabled = false;
  }

  function clearFileB() {
    fileB = null;
    document.getElementById('fileInputB').value = '';
    document.getElementById('filePreviewB').style.display = 'none';
    document.getElementById('dropzoneB').style.display = '';
    document.getElementById('runCompareBtn').disabled = true;
    hideCompareError();
  }

  async function runComparison() {
    // Get file A from the main upload
    const fileInputA = document.getElementById('fileInput');
    const fileA = fileInputA.files[0];
    if (!fileA || !fileB) return;

    const btn = document.getElementById('runCompareBtn');
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Uploading...';
    hideCompareError();

    const formData = new FormData();
    formData.append('file_a', fileA);
    formData.append('file_b', fileB);

    try {
      const resp = await fetch('/api/analyze/compare', {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || 'Comparison failed');
      }

      const data = await resp.json();
      // Reset processing UI before switching view
      Polling.resetProcessingUI();
      resultA = null;
      resultB = null;
      errorsA = 0;
      errorsB = 0;
      App.switchView('processing', true);
      BrainView.startProcessingAnimation();
      startDualPolling(data.job_id_a, data.job_id_b);
    } catch (err) {
      btn.disabled = false;
      btn.querySelector('.btn-text').textContent = 'Compare Designs';
      showCompareError('Comparison error: ' + err.message);
    }
  }

  function stopPolling() {
    if (pollIntervalA) { clearInterval(pollIntervalA); pollIntervalA = null; }
    if (pollIntervalB) { clearInterval(pollIntervalB); pollIntervalB = null; }
    errorsA = 0;
    errorsB = 0;
  }

  function startDualPolling(jobIdA, jobIdB) {
    const title = document.getElementById('processingTitle');
    title.textContent = 'Analyzing both designs...';

    pollIntervalA = setInterval(async () => {
      try {
        const resp = await fetch(`/api/jobs/${jobIdA}`);
        const job = await resp.json();
        errorsA = 0;
        if (job.status === 'completed') {
          clearInterval(pollIntervalA);
          pollIntervalA = null;
          resultA = job;
          checkBothDone();
        } else if (job.status === 'failed') {
          stopPolling();
          title.textContent = 'Design A failed: ' + (job.error || 'Unknown');
        } else {
          updateCompareProgress(job.progress, resultB ? 1 : 0);
        }
      } catch (e) {
        errorsA++;
        if (errorsA >= 5) {
          title.textContent = 'Connection lost. Retrying...';
        }
        if (errorsA >= 10) {
          stopPolling();
          title.textContent = 'Connection lost. Please try again.';
        }
      }
    }, 2000);

    pollIntervalB = setInterval(async () => {
      try {
        const resp = await fetch(`/api/jobs/${jobIdB}`);
        const job = await resp.json();
        errorsB = 0;
        if (job.status === 'completed') {
          clearInterval(pollIntervalB);
          pollIntervalB = null;
          resultB = job;
          checkBothDone();
        } else if (job.status === 'failed') {
          stopPolling();
          title.textContent = 'Design B failed: ' + (job.error || 'Unknown');
        } else {
          updateCompareProgress(resultA ? 1 : 0, job.progress);
        }
      } catch (e) {
        errorsB++;
        if (errorsB >= 5) {
          title.textContent = 'Connection lost. Retrying...';
        }
        if (errorsB >= 10) {
          stopPolling();
          title.textContent = 'Connection lost. Please try again.';
        }
      }
    }, 2000);
  }

  function updateCompareProgress(progA, progB) {
    const avg = ((progA || 0) + (progB || 0)) / 2;
    const bar = document.getElementById('progressBar');
    const pct = document.getElementById('progressPct');
    if (bar) bar.style.width = (avg * 100) + '%';
    if (pct) pct.textContent = Math.round(avg * 100) + '%';
  }

  function checkBothDone() {
    if (resultA && resultB) {
      BrainView.stopProcessingAnimation();
      renderComparison(resultA, resultB);
    }
  }

  function renderComparison(jobA, jobB) {
    // Switch to compare view
    App.switchView('compare');

    const metricsA = document.getElementById('compareMetricsA');
    const metricsB = document.getElementById('compareMetricsB');
    const deltas = document.getElementById('compareDeltas');

    metricsA.innerHTML = '';
    metricsB.innerHTML = '';
    deltas.innerHTML = '';

    const zA = jobA.z_scores || {};
    const zB = jobB.z_scores || {};
    const metricKeys = Object.keys(METRIC_LABELS);

    for (const key of metricKeys) {
      const valA = zA[key] || 0;
      const valB = zB[key] || 0;
      const diff = valB - valA;
      const pctDiff = valA !== 0 ? ((diff / Math.abs(valA)) * 100) : (diff * 100);
      const significant = Math.abs(pctDiff) > 20;

      // Design A metric
      metricsA.innerHTML += `<div class="compare-metric-row">
        <span class="compare-metric-name">${METRIC_LABELS[key]}</span>
        <span class="compare-metric-value">z=${valA.toFixed(2)}</span>
      </div>`;

      // Design B metric
      metricsB.innerHTML += `<div class="compare-metric-row">
        <span class="compare-metric-name">${METRIC_LABELS[key]}</span>
        <span class="compare-metric-value">z=${valB.toFixed(2)}</span>
      </div>`;

      // Delta
      const sign = diff > 0 ? '+' : '';
      const cls = diff > 0.1 ? 'delta-positive' : (diff < -0.1 ? 'delta-negative' : 'delta-neutral');
      const sigCls = significant ? ' delta-significant' : '';
      deltas.innerHTML += `<div class="compare-delta-row ${cls}${sigCls}">
        ${sign}${diff.toFixed(2)} ${significant ? '\u26A0' : ''}
      </div>`;
    }

    // Friction scores
    renderCompareFriction('compareFrictionA', jobA.friction_score);
    renderCompareFriction('compareFrictionB', jobB.friction_score);

    // Comparative analysis text
    const analysisEl = document.getElementById('compareAnalysisText');
    const analysisA = jobA.llm_analysis || '';
    const analysisB = jobB.llm_analysis || '';
    analysisEl.innerHTML = `
      <h2>Design A</h2>
      ${formatAnalysisHTML(analysisA)}
      <h2>Design B</h2>
      ${formatAnalysisHTML(analysisB)}
    `;
  }

  function renderCompareFriction(containerId, score) {
    const el = document.getElementById(containerId);
    const numEl = el.querySelector('.compare-friction-num');
    if (score == null) {
      numEl.textContent = '--';
      return;
    }
    numEl.textContent = score.toFixed(1);
    let color;
    if (score <= 3) color = 'var(--phosphor)';
    else if (score <= 5) color = 'var(--cyan)';
    else if (score <= 7) color = 'var(--amber)';
    else color = 'var(--red)';
    numEl.style.color = color;
  }

  function formatAnalysisHTML(text) {
    if (!text) return '<p style="color:var(--text-dim)">No analysis</p>';
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return text
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^(\d+)\. (.+)$/gm, '<li>$1. $2</li>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>')
      .replace(/FRICTION_SCORE:.*?(<br>|$)/gi, '');
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function reset() {
    stopPolling();
    resultA = null;
    resultB = null;
    fileB = null;
    const compareUpload = document.getElementById('compareUpload');
    if (compareUpload) compareUpload.style.display = 'none';
    const compareBtn = document.getElementById('compareBtn');
    if (compareBtn) compareBtn.style.display = '';
    // Reset the compare button state
    const runBtn = document.getElementById('runCompareBtn');
    if (runBtn) {
      runBtn.disabled = true;
      runBtn.querySelector('.btn-text').textContent = 'Compare Designs';
    }
    clearFileB();
  }

  return { init, reset, stopPolling };
})();
