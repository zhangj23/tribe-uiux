/**
 * Render LLM analysis text, friction score, playback controls, and copy button.
 */
const Results = (() => {
<<<<<<< Updated upstream
  function render(jobData) {
=======
  let sliderHandler = null;
  let playInterval = null;
  let isPlaying = false;
  let currentJobData = null;

  function render(jobData) {
    currentJobData = jobData;
    BrainView.init();

>>>>>>> Stashed changes
    renderFrictionScore(jobData.friction_score);
    renderAnalysis(jobData.llm_analysis);
    renderBrain(jobData);
    renderCharts(jobData);
    setupTimestepSlider(jobData);
    setupCopyButton(jobData);
    setupPlaybackControls(jobData);
    setupMetricToggles();
  }

  function renderFrictionScore(score) {
    const numberEl = document.getElementById('frictionNumber');
    const fillEl = document.getElementById('frictionFill');

    if (score == null) {
      numberEl.textContent = '--';
      return;
    }

    const rounded = score.toFixed(1);
    numberEl.textContent = rounded;

    let color;
    if (score <= 3) {
      color = 'var(--phosphor)';
    } else if (score <= 5) {
      color = 'var(--cyan)';
    } else if (score <= 7) {
      color = 'var(--amber)';
    } else {
      color = 'var(--red)';
    }

    numberEl.style.color = color;
    fillEl.style.width = (score / 10 * 100) + '%';
    fillEl.style.background = color;
  }

  function renderAnalysis(text) {
    const container = document.getElementById('analysisText');
    if (!text) {
      container.innerHTML = '<p style="color: var(--text-dim)">No analysis available.</p>';
      return;
    }

<<<<<<< Updated upstream
    // Simple markdown-like rendering
=======
    // Escape HTML entities to prevent XSS from LLM output
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

>>>>>>> Stashed changes
    let html = text
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^(\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');

    html = html.replace(/((<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');
    html = '<p>' + html + '</p>';
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>\s*(<h[23]>)/g, '$1');
    html = html.replace(/(<\/h[23]>)\s*<\/p>/g, '$1');
    html = html.replace(/<p>\s*(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');
    html = html.replace(/FRICTION_SCORE:.*?(<br>|<\/p>)/gi, '$1');

    container.innerHTML = html;
  }

  function renderBrain(jobData) {
    if (jobData.brain_activations && jobData.brain_activations.length > 0) {
      BrainView.setData(jobData.brain_activations);
    }
  }

  function renderCharts(jobData) {
    if (jobData.z_scores) {
      Charts.renderGauges(jobData.z_scores);
    }
    if (jobData.timeseries && jobData.timestamps) {
      Charts.renderTimeseries(jobData.timeseries, jobData.timestamps);
    }
  }

  function setupTimestepSlider(jobData) {
    const slider = document.getElementById('timestepSlider');
    const label = document.getElementById('timestepValue');

    if (!jobData.brain_activations || !jobData.timestamps) return;

    const maxStep = jobData.brain_activations.length - 1;
    slider.max = maxStep;
    slider.value = 0;

<<<<<<< Updated upstream
    slider.addEventListener('input', () => {
=======
    if (sliderHandler) {
      slider.removeEventListener('input', sliderHandler);
    }

    sliderHandler = () => {
>>>>>>> Stashed changes
      const step = parseInt(slider.value);
      BrainView.setTimestep(step);
      if (jobData.timestamps[step] !== undefined) {
        label.textContent = jobData.timestamps[step].toFixed(2) + 's';
      }
    });
  }

  /* ======== COPY ANALYSIS ======== */

  function setupCopyButton(jobData) {
    const btn = document.getElementById('copyAnalysisBtn');
    if (!btn) return;

    btn.onclick = () => {
      const text = jobData.llm_analysis || '';
      navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = orig;
          btn.classList.remove('copied');
        }, 1500);
      });
    };
  }

  /* ======== PLAYBACK CONTROLS ======== */

  function setupPlaybackControls(jobData) {
    const btn = document.getElementById('playPauseBtn');
    if (!btn || !jobData.brain_activations) return;

    // Reset state
    stopPlayback();

    btn.onclick = () => togglePlayback();

    // Keyboard shortcut
    document.onkeydown = (e) => {
      // Only when results view is active and not typing in an input
      if (e.code === 'Space' && document.getElementById('viewResults').classList.contains('view--active')) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        togglePlayback();
      }
    };
  }

  function togglePlayback() {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }

  function startPlayback() {
    if (!currentJobData || !currentJobData.brain_activations) return;
    isPlaying = true;
    const btn = document.getElementById('playPauseBtn');
    if (btn) btn.textContent = '\u23F8'; // pause icon

    const slider = document.getElementById('timestepSlider');
    const label = document.getElementById('timestepValue');
    const maxStep = currentJobData.brain_activations.length - 1;

    playInterval = setInterval(() => {
      let step = parseInt(slider.value) + 1;
      if (step > maxStep) step = 0;
      slider.value = step;
      BrainView.setTimestep(step);
      if (currentJobData.timestamps[step] !== undefined) {
        label.textContent = currentJobData.timestamps[step].toFixed(2) + 's';
      }
    }, 500); // ~2 fps
  }

  function stopPlayback() {
    isPlaying = false;
    const btn = document.getElementById('playPauseBtn');
    if (btn) btn.textContent = '\u25B6'; // play icon
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
  }

  /* ======== METRIC TOGGLES ======== */

  function setupMetricToggles() {
    const container = document.getElementById('metricToggles');
    if (!container) return;

    container.querySelectorAll('.metric-toggle').forEach(btn => {
      btn.onclick = () => {
        // Remove active from all
        container.querySelectorAll('.metric-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const metric = btn.dataset.metric || null;
        BrainView.setMetricFilter(metric);
      };
    });
  }

  return { render };
})();
