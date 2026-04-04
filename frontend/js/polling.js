/**
 * Job status polling -- polls GET /api/jobs/{id} every 2 seconds.
 */
const Polling = (() => {
  let intervalId = null;
  let currentJobId = null;
  let consecutiveErrors = 0;

  const STAGE_TITLES = {
    created: 'Initializing...',
    converting: 'Converting media...',
    predicting: 'Running neural prediction...',
    mapping: 'Analyzing brain regions...',
    interpreting: 'Generating recommendations...',
    completed: 'Analysis complete',
    failed: 'Analysis failed',
  };

  const STAGE_ORDER = ['converting', 'predicting', 'mapping', 'interpreting'];

  function start(jobId) {
    currentJobId = jobId;
    consecutiveErrors = 0;
    poll(); // immediate first check
    intervalId = setInterval(poll, 2000);
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    currentJobId = null;
    consecutiveErrors = 0;
  }

  function resetProcessingUI() {
    const bar = document.getElementById('progressBar');
    const pct = document.getElementById('progressPct');
    const title = document.getElementById('processingTitle');
    const stage = document.getElementById('progressStage');

    if (bar) bar.style.width = '0%';
    if (pct) pct.textContent = '0%';
    if (title) title.textContent = 'Initializing...';
    if (stage) stage.textContent = 'CREATED';

    document.querySelectorAll('.stage').forEach((el) => {
      el.classList.remove('active', 'done');
    });
  }

  async function poll() {
    if (!currentJobId) return;

    try {
      const resp = await fetch(`/api/jobs/${currentJobId}`);
      if (!resp.ok) throw new Error('Job not found');

      const job = await resp.json();
      consecutiveErrors = 0;
      updateProcessingUI(job);

      if (job.status === 'completed') {
        stop();
        App.showResults(job);
      } else if (job.status === 'failed') {
        stop();
        const title = document.getElementById('processingTitle');
        if (title) title.textContent = 'Analysis failed: ' + (job.error || 'Unknown error');
        App.showUpload();
      }
    } catch (err) {
      console.error('Polling error:', err);
      consecutiveErrors++;

      const title = document.getElementById('processingTitle');
      if (consecutiveErrors >= 10) {
        stop();
        if (title) title.textContent = 'Connection lost. Please try again.';
      } else if (consecutiveErrors >= 5) {
        if (title) title.textContent = 'Connection lost. Retrying...';
      }
    }
  }

  function updateProcessingUI(job) {
    const title = document.getElementById('processingTitle');
    const bar = document.getElementById('progressBar');
    const glow = document.getElementById('progressGlow');
    const pct = document.getElementById('progressPct');
    const stage = document.getElementById('progressStage');

    title.textContent = STAGE_TITLES[job.status] || 'Processing...';
    bar.style.width = (job.progress * 100) + '%';
    glow.style.left = `calc(${job.progress * 100}% - 30px)`;
    pct.textContent = Math.round(job.progress * 100) + '%';
    stage.textContent = job.status.toUpperCase();

    // Update stage indicators
    const currentIdx = STAGE_ORDER.indexOf(job.status);
    document.querySelectorAll('.stage').forEach((el) => {
      const stageKey = el.dataset.stage;
      const stageIdx = STAGE_ORDER.indexOf(stageKey);
      el.classList.remove('active', 'done');
      if (stageIdx === currentIdx) {
        el.classList.add('active');
      } else if (stageIdx < currentIdx) {
        el.classList.add('done');
      }
    });
  }

  return { start, stop, resetProcessingUI };
})();
