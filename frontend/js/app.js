/**
 * Main application controller — view switching and orchestration.
 */
const App = (() => {
  const views = {
    upload: document.getElementById('viewUpload'),
    processing: document.getElementById('viewProcessing'),
    results: document.getElementById('viewResults'),
  };

  function init() {
    Upload.init();
    BrainView.init();

    // New analysis button
    document.getElementById('newAnalysisBtn').addEventListener('click', () => {
      showUpload();
    });

    // Check backend health
    checkHealth();
  }

  function switchView(name) {
    Object.values(views).forEach(v => {
      v.classList.remove('view--active', 'view-enter');
    });
    const target = views[name];
    target.classList.add('view--active', 'view-enter');
  }

  function showUpload() {
    Polling.stop();
    BrainView.stopProcessingAnimation();
    Upload.clearFile();
    switchView('upload');
  }

  function startProcessing(jobId) {
    switchView('processing');
    BrainView.startProcessingAnimation();
    Polling.start(jobId);
  }

  function showResults(jobData) {
    BrainView.stopProcessingAnimation();
    switchView('results');
    Results.render(jobData);
  }

  async function checkHealth() {
    try {
      const resp = await fetch('/api/health');
      const data = await resp.json();
      const indicator = document.getElementById('statusIndicator');
      const statusText = indicator.querySelector('.status-text');
      const statusDot = indicator.querySelector('.status-dot');

      if (data.tribe_mock_mode) {
        statusText.textContent = 'MOCK MODE';
        statusDot.style.background = 'var(--amber)';
        statusDot.style.boxShadow = '0 0 8px var(--amber-dim)';
      } else {
        statusText.textContent = data.model_loaded ? 'MODEL READY' : 'LOADING...';
        statusDot.style.background = data.model_loaded ? 'var(--phosphor)' : 'var(--cyan)';
      }
    } catch {
      // Backend not reachable — that's fine during development
    }
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);

  // Public API (used by other modules)
  return { showUpload, startProcessing, showResults };
})();
