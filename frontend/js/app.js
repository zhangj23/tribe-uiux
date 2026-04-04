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

    // New analysis button
    document.getElementById('newAnalysisBtn').addEventListener('click', () => {
      showUpload();
    });

    // Cancel button in processing view
    document.getElementById('cancelBtn').addEventListener('click', () => {
      Polling.stop();
      BrainView.stopProcessingAnimation();
      showUpload();
    });

    // Browser history navigation
    window.addEventListener('popstate', (e) => {
      const view = (e.state && e.state.view) || 'upload';
      Polling.stop();
      BrainView.stopProcessingAnimation();
      // For any back navigation, show the target view directly
      Object.values(views).forEach(v => v.classList.remove('view--active', 'view-enter'));
      const target = views[view] || views.upload;
      target.classList.add('view--active', 'view-enter');
    });

    // Check backend health
    checkHealth();
  }

  function switchView(name, replace = false) {
    Object.values(views).forEach(v => {
      v.classList.remove('view--active', 'view-enter');
    });
    const target = views[name];
    target.classList.add('view--active', 'view-enter');
    const method = replace ? 'replaceState' : 'pushState';
    history[method]({ view: name }, '', '#' + name);
  }

  function showUpload() {
    Polling.stop();
    BrainView.stopProcessingAnimation();
    Upload.clearFile();
    switchView('upload');
  }

  function startProcessing(jobId) {
    Polling.resetProcessingUI();
    switchView('processing', true); // replaceState so back goes to upload
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
      // Backend not reachable
    }
  }

  // Initialize on DOM ready
  document.addEventListener('DOMContentLoaded', init);

  // Public API
  return { showUpload, startProcessing, showResults };
})();
