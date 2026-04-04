/**
 * Render LLM analysis text and friction score.
 */
const Results = (() => {
  let sliderHandler = null;

  function render(jobData) {
    // Lazy-init brain view on first render
    BrainView.init();

    renderFrictionScore(jobData.friction_score);
    renderAnalysis(jobData.llm_analysis);
    renderBrain(jobData);
    renderCharts(jobData);
    setupTimestepSlider(jobData);
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

    // Color based on score
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

    // Escape HTML entities to prevent XSS from LLM output
    text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Simple markdown-like rendering
    let html = text
      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Numbered lists
      .replace(/^(\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>')
      // Unordered lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Paragraphs (double newlines)
      .replace(/\n\n/g, '</p><p>')
      // Single newlines within content
      .replace(/\n/g, '<br>');

    // Wrap consecutive <li> elements in <ol>
    html = html.replace(/((<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');

    // Wrap in paragraphs
    html = '<p>' + html + '</p>';

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');
    html = html.replace(/<p>\s*(<h[23]>)/g, '$1');
    html = html.replace(/(<\/h[23]>)\s*<\/p>/g, '$1');
    html = html.replace(/<p>\s*(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)\s*<\/p>/g, '$1');

    // Remove FRICTION_SCORE line from display
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

    // Remove previous listener to avoid accumulation
    if (sliderHandler) {
      slider.removeEventListener('input', sliderHandler);
    }

    sliderHandler = () => {
      const step = parseInt(slider.value);
      BrainView.setTimestep(step);
      if (jobData.timestamps[step] !== undefined) {
        label.textContent = jobData.timestamps[step].toFixed(2) + 's';
      }
    };

    slider.addEventListener('input', sliderHandler);
  }

  return { render };
})();
