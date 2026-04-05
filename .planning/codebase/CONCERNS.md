# Codebase Concerns

**Analysis Date:** 2026-04-05

## Tech Debt

**Hardcoded baseline statistics:**
- Issue: `DEFAULT_BASELINES` in `backend/app/services/brain_mapper.py` are placeholder values ("reasonable defaults for mock mode") that don't reflect real population data
- Files: `backend/app/services/brain_mapper.py` (lines 12-21)
- Impact: Z-scores computed against mock baselines are meaningless for real usage. Baselines should come from `data/baselines/baselines.json` which requires running `scripts/generate_baselines.py` with real TRIBE data
- Fix approach: Document the baseline generation workflow clearly and enforce loading from the JSON file. Add validation to warn if using defaults in production mode

**Mock atlas region assignments:**
- Issue: When nilearn fails to load the Destrieux atlas, the code falls back to a manually-crafted mock mapping (`_create_mock_region_assignments` in `brain_mapper.py`)
- Files: `backend/app/services/brain_mapper.py` (lines 50-74)
- Impact: Vertex-to-region mappings are approximate and don't match real Destrieux coordinates. Frontend displays anatomically incorrect brain region names
- Fix approach: Make nilearn/atlas loading required (not optional) in production mode. Fail fast with clear error if atlas data is unavailable

**TRIBE model tiling for single-segment output:**
- Issue: When TRIBE returns only 1 segment, code tiles it to 30 timesteps and adds small noise to simulate temporal dynamics
- Files: `backend/app/services/tribe_runner.py` (lines 165-172)
- Impact: Artificial temporal variation masks the actual neural response. Temporal hotspots and timeseries charts show fake peaks that don't correspond to real media events
- Fix approach: Handle single-segment case explicitly — either raise an error, request longer media, or return the segment as-is with a single timestamp

**Duplicate file type classification:**
- Issue: Media type classification is implemented 3 times with slight variations:
  - `upload.py` (lines 24-40)
  - `compare.py` (lines 32-49)
  - `analyze_url.py` (inferred from routing)
- Files: `backend/app/routers/upload.py`, `backend/app/routers/compare.py`
- Impact: Changes to allowed formats must be made in 3 places. Risk of inconsistent behavior across endpoints
- Fix approach: Move media classification to a shared utility (e.g., `app/services/media_classifier.py`) and use it everywhere

**ffmpeg-python usage:**
- Issue: `ffmpeg-python` package is listed in requirements.txt but never imported or used
- Files: `backend/requirements.txt` (line 11)
- Impact: Dead dependency increases attack surface and maintenance burden
- Fix approach: Remove from requirements.txt. Subprocess calls directly to ffmpeg/ffprobe are more reliable

**Blocking subprocess calls without timeout:**
- Issue: Media conversion subprocess calls don't have explicit timeouts
- Files: `backend/app/services/media_converter.py` (lines 73-84, 111-121) — ffmpeg runs unbounded
- Impact: Hung ffmpeg process blocks the thread pool executor. With max 2 workers, second job can't start if first ffmpeg hangs
- Fix approach: Add `timeout=300` parameter to all subprocess.run calls. Catch TimeoutExpired and fail the job gracefully

## Known Bugs

**Dockerfile merge conflict:**
- Symptoms: Docker build fails; two conflicting base images and dependency installs
- Files: `Dockerfile` (lines 1-92)
- Trigger: Recent merge attempt left git conflict markers (`<<<<<<< HEAD` to `>>>>>>> d0d1a0d6394f3056b5fc3604ebbbde3488b60a76`) unresolved
- Workaround: Manual conflict resolution required before any Docker build
- Fix: Decide on single base image (CUDA for GPU vs Python slim for CPU) and remove conflict markers

**Playwright dependency not installed in all setups:**
- Symptoms: `/api/analyze/url` endpoint crashes with "Playwright not installed" when reached
- Files: `backend/app/routers/analyze_url.py` (lines 29-35)
- Trigger: Call `POST /api/analyze/url` without running `pip install playwright && npx playwright install`
- Workaround: Install Playwright manually before using URL analysis
- Fix: Add Playwright to `requirements.txt` with conditional logic to skip browser install in mock mode

**Job status polling hard-coded to 2 seconds:**
- Symptoms: Frontend polls every 2 seconds regardless of expected job duration. Network churn for long jobs
- Files: `frontend/js/polling.js` (line 25)
- Trigger: Any job analysis takes >10 minutes (e.g., on slow GPU)
- Workaround: None — user sees constant network activity
- Fix: Implement exponential backoff (start at 2s, increase to 10s if no progress change detected)

**Image media type hardcoded in analyze_url:**
- Symptoms: URL analysis always treats screenshot as image, even if URL loads a video player
- Files: `backend/app/routers/analyze_url.py` (line 99)
- Trigger: Analyze a YouTube page or any site with embedded video
- Workaround: Use file upload with video file instead
- Fix: Detect if URL is video streaming site (regex check) or add media type parameter

**Brain activation downsampling not documented:**
- Symptoms: Frontend receives 1024 vertices (every 20th), but this mapping isn't described anywhere
- Files: `backend/app/services/brain_mapper.py` (lines 165-168), `frontend/js/brain-view.js` (line 29)
- Trigger: Code review or debugging vertex coordinates
- Workaround: Hardcoded constant in both places, must match manually
- Fix: Define `VERTEX_DOWNSAMPLE_STEP = 20` as a constant in `brain_regions.py` and import it everywhere

## Security Considerations

**CORS allows all origins:**
- Risk: Any website can make requests to this backend and steal analysis results
- Files: `backend/app/main.py` (lines 42-47)
- Current mitigation: Only HTTP attacks; no authentication layer yet
- Recommendations: (1) Restrict `allow_origins` to known frontend domain(s); (2) Add API key or OAuth; (3) Rate-limit uploads by IP

**No file size validation before saving:**
- Risk: Attacker uploads 100GB file, exhausts disk space
- Files: `backend/app/routers/upload.py` (lines 44-50) — saves directly without size check
- Current mitigation: filesystem limits (if any)
- Recommendations: (1) Check file size before writing (compare to `MAX_FILE_SIZE` in frontend); (2) Add disk space monitoring; (3) Implement per-user quota

**URL analysis allows arbitrary domains:**
- Risk: Attacker uses endpoint as proxy to screenshot internal networks (SSRF)
- Files: `backend/app/routers/analyze_url.py` (lines 71-102)
- Current mitigation: Basic regex URL validation (lines 75-80)
- Recommendations: (1) Block private IPs (127.0.0.1, 10.x.x.x, 192.168.x.x); (2) Use allowlist of safe domains; (3) Set low timeout; (4) Disable JavaScript in Playwright

**Uploaded files stored with predictable naming:**
- Risk: If upload directory is web-accessible, attacker can guess filenames and download other users' media
- Files: `backend/app/routers/upload.py` (line 48), `backend/app/routers/compare.py` (line 54)
- Current mitigation: Filename sanitization but path is under `data/uploads/`
- Recommendations: (1) Store uploaded files outside web root; (2) Use random UUIDs, not user-facing names; (3) Serve only via authenticated endpoints

**No input validation on LLM prompt injection:**
- Risk: Crafted z-score values could be manipulated to trigger undesired LLM behavior
- Files: `backend/app/services/llm_interpreter.py` (lines 53-72)
- Current mitigation: Values are server-computed, not user input
- Recommendations: (1) Validate z-scores are numeric and in expected range; (2) Sanitize timeseries values before inclusion in prompt

**API key stored in environment variable without rotation:**
- Risk: If `.env` is leaked, attacker has permanent access to Anthropic API
- Files: `backend/app/config.py` (line 22), `.env` file (not committed but may be exposed)
- Current mitigation: `.env` in `.gitignore`
- Recommendations: (1) Implement key rotation; (2) Use environment-specific keys; (3) Add monitoring for unusual API usage

## Performance Bottlenecks

**Serial media conversion + TRIBE inference:**
- Problem: Pipeline runs 5 steps sequentially (convert → predict → map → interpret → return). Each step blocks the next
- Files: `backend/app/services/pipeline.py` (lines 20-101)
- Cause: Thread pool executor has only 2 workers; jobs queue up
- Improvement path: (1) Increase `ThreadPoolExecutor(max_workers=2)` to `max_workers=4` or CPU count; (2) Pre-convert media in background task; (3) Cache converted videos to avoid re-encoding

**TRIBE ViT-G backbone requires 10GB+ VRAM:**
- Problem: Model won't load on GPUs with <10GB VRAM; falls back to CPU (50x slower)
- Files: `backend/app/services/tribe_compat.py` (lines 43-46)
- Cause: Meta's ViT-G model is memory-intensive; no quantization option
- Improvement path: (1) Use RunPod serverless (already supported); (2) Implement model quantization; (3) Add option to use smaller ViT-B backbone

**Brain mapper loads and regenerates vertex masks on every inference:**
- Problem: `_get_region_vertex_masks()` rebuilds 6 boolean arrays (20,484 elements each) for every job
- Files: `backend/app/services/brain_mapper.py` (lines 113, 77-96)
- Cause: Masks are computed fresh, not cached
- Improvement path: Cache masks at module load time (lines 113-114); compute once and reuse

**Frontend renders full timeseries chart on every timestep change:**
- Problem: Timeseries chart re-renders when user moves slider (60+ times if dragging)
- Files: `frontend/js/results.js` (setupTimestepSlider → chart redraw)
- Cause: No debouncing on slider events
- Improvement path: Debounce slider input to 100ms; only update brain view on every change, chart on release

**Image screenshots from URLs can be very large:**
- Problem: Playwright screenshot creates full-page PNG (potentially 10,000+ px height). Not downsampled before TRIBE
- Files: `backend/app/routers/analyze_url.py` (line 58-62)
- Cause: No image downsampling step
- Improvement path: Cap screenshot height to 5000px and/or downscale to 1920 width

## Fragile Areas

**Brain region mapping via substring matching:**
- Files: `backend/app/services/brain_mapper.py` (lines 87-93), `backend/app/models/brain_regions.py`
- Why fragile: Region names from Destrieux atlas are matched by substring (e.g., "G_front_inf" matches both "G_front_inf-Opercular" and "G_front_inf-Triangul"). Overlapping substrings can cause a vertex to map to multiple groups or none
- Safe modification: Add unit tests that verify all 148 Destrieux labels map to exactly one UX metric group. Test against actual atlas data
- Test coverage: No tests exist for region mapping logic

**LLM prompt parsing for friction score:**
- Files: `backend/app/services/llm_interpreter.py` (lines 139-147)
- Why fragile: Regex expects "FRICTION_SCORE: X" on its own line. If Claude formats it differently (e.g., "Friction: 5" or "Score (1-10): 5"), parsing fails silently and returns default 5.0
- Safe modification: Add structured output format (Claude API accepts JSON schema). Validate parsed score is in range [1, 10]
- Test coverage: No tests for friction score extraction

**Timestamps from TRIBE model may not align with media duration:**
- Files: `backend/app/services/tribe_runner.py` (lines 173-181)
- Why fragile: Real TRIBE returns segment objects with `.start` or `.offset` attributes that may not correspond to actual media time. If segment times exceed media duration, timeline is wrong
- Safe modification: Validate timestamps are monotonically increasing and don't exceed computed duration. Add explicit assertion
- Test coverage: Tested only in mock mode, not with real TRIBE output

**Job cleanup is race-condition-prone:**
- Files: `backend/app/services/job_manager.py` (lines 49-63)
- Why fragile: `_cleanup_old_jobs()` called at creation time without locks. In concurrent scenario, two requests might both trigger cleanup and delete the same job
- Safe modification: Add lock around job dictionary modifications. Consider Redis for distributed deployments
- Test coverage: No concurrent tests

**Canvas rendering assumes 1024 vertices:**
- Files: `frontend/js/brain-view.js` (lines 19, 29)
- Why fragile: Brain layout is generated for exactly 1024 points. If downsampling step changes, layout breaks
- Safe modification: Make vertex count dynamic based on actual data length. Regenerate layout if count changes
- Test coverage: No tests

## Scaling Limits

**In-memory job storage:**
- Current capacity: 100 jobs max (hard cap in `job_manager.py`)
- Limit: At 100 jobs, oldest jobs are deleted. No persistence; restarting server loses all job state
- Scaling path: (1) Add SQLite/PostgreSQL backend for job persistence; (2) Implement job TTL with automatic cleanup; (3) Add job archival to object storage (S3); (4) Use Redis for distributed cache

**Thread pool executor with 2 workers:**
- Current capacity: 2 concurrent jobs max
- Limit: 3rd job waits for one to finish (media conversion can take 30+ seconds per job = 1-2 min latency)
- Scaling path: (1) Increase to `max_workers=min(8, cpu_count())`; (2) Use async/await throughout (currently blocking threads); (3) Offload TRIBE to RunPod or other GPU service

**Baselines file is static JSON:**
- Current capacity: Single global baseline for all users. No per-demographic or per-industry baselines
- Limit: One-size-fits-all z-scores may not be meaningful for niche use cases
- Scaling path: (1) Store baselines in database with metadata (study_cohort, country, etc.); (2) Allow users to select baseline; (3) Implement online learning to update baselines as new data arrives

## Dependencies at Risk

**Anthropic API (`anthropic>=0.40.0`):**
- Risk: API contract or pricing model could change. No fallback for LLM analysis (only mock)
- Impact: If API becomes unavailable or unaffordable, analysis feature stops working
- Migration plan: (1) Support multiple LLM backends (OpenAI, Hugging Face); (2) Cache analysis results; (3) Ship a lightweight on-device model for fallback

**TRIBE v2 (not pinned, from GitHub):**
- Risk: Research model, not production-hardened. Updates may break backward compatibility
- Impact: Inference could fail silently or produce different outputs
- Migration plan: (1) Pin to specific commit hash in git clone; (2) Vendor the model weights locally; (3) Monitor GitHub repo for critical updates

**Playwright (`pip install playwright`, no version in requirements):**
- Risk: Browser automation tool; major version changes break API. Not in requirements.txt
- Impact: URL analysis feature may fail on missing dependency
- Migration plan: (1) Add to requirements.txt with version pin; (2) Consider selenium or puppeteer alternatives; (3) Deprecate URL analysis in favor of file upload

**nilearn (atlases from external source):**
- Risk: Atlas download may fail or be slow on first use
- Impact: Analysis fails if nilearn can't fetch Destrieux atlas
- Migration plan: (1) Ship atlas data in the repo; (2) Cache atlas locally; (3) Implement offline mode

**ffmpeg (system dependency):**
- Risk: Not bundled; Windows/Mac require manual installation
- Impact: Media conversion fails if ffmpeg not on PATH
- Migration plan: (1) Use Docker to guarantee ffmpeg availability; (2) Use Python library like `moviepy` instead; (3) Bundle ffmpeg binary

## Missing Critical Features

**No job queue persistence:**
- Problem: If server restarts, all in-progress and queued jobs are lost
- Blocks: Production deployment. Users cannot rely on analysis finishing
- Priority: High — essential for reliability

**No job cancellation:**
- Problem: User can't stop a long-running analysis once uploaded
- Blocks: User experience for slow jobs (TRIBE takes 5-10 min per video on CPU)
- Priority: Medium — quality-of-life feature

**No result caching:**
- Problem: Analyzing the same image twice runs full pipeline twice
- Blocks: A/B testing and comparison workflows (analyzing many variants)
- Priority: Medium — performance optimization

**No multi-user support:**
- Problem: All jobs share global space. No auth means one user can see another's results via `/api/jobs/{id}`
- Blocks: Multi-tenant or team scenarios
- Priority: High — security issue

**No progress streaming:**
- Problem: Frontend polls every 2 seconds. No server-sent events or WebSockets
- Blocks: Real-time progress updates and lower latency
- Priority: Low — nice-to-have

**No metrics comparison between jobs:**
- Problem: Compare feature exists but only shows side-by-side results, not computed deltas
- Blocks: Detailed A/B testing analysis
- Priority: Low — enhancement

## Test Coverage Gaps

**Brain mapper region mapping untested:**
- What's not tested: Whether all 148 Destrieux atlas labels map to correct UX metrics; overlapping substrings; edge cases
- Files: `backend/app/services/brain_mapper.py` (lines 77-96)
- Risk: Region misclassification silently produces wrong z-scores
- Recommendation: Add unit tests with full Destrieux atlas labels

**Z-score computation untested:**
- What's not tested: Baseline loading, mean/std computation, z-score formula
- Files: `backend/app/services/brain_mapper.py` (lines 99-136)
- Risk: Normalization bug goes unnoticed
- Recommendation: Add parametrized tests with known input/output pairs

**LLM prompt formatting untested:**
- What's not tested: Friction score parsing, markdown rendering on frontend
- Files: `backend/app/services/llm_interpreter.py` (lines 119-147), `frontend/js/results.js` (lines 47-80)
- Risk: Parsing failures silently degrade UX
- Recommendation: Add tests with real Claude outputs (mock different formatting variations)

**TRIBE inference edge cases untested:**
- What's not tested: Single-segment output, empty predictions, very short media
- Files: `backend/app/services/tribe_runner.py` (lines 146-183)
- Risk: Crashes or malformed data passed downstream
- Recommendation: Add tests with mock TRIBE returning edge case outputs

**Media conversion without ffmpeg untested:**
- What's not tested: Behavior when ffmpeg is not installed, subprocess timeouts, corrupt media files
- Files: `backend/app/services/media_converter.py`
- Risk: Cryptic errors instead of user-friendly messages
- Recommendation: Mock subprocess to test error paths

**Frontend interaction untested:**
- What's not tested: Upload UI, file validation, drag-drop, polling state machine, comparison flow
- Files: `frontend/js/` (all files)
- Risk: UI bugs only discovered in production
- Recommendation: Set up Playwright E2E tests (already a dependency for URL analysis)

**Job manager concurrency untested:**
- What's not tested: Race conditions in job creation/cleanup, multiple workers accessing same job
- Files: `backend/app/services/job_manager.py`
- Risk: Lost updates or race conditions under load
- Recommendation: Add concurrent tests with ThreadPoolExecutor

**Baseline loading fallback untested:**
- What's not tested: Behavior when `baselines.json` is missing, corrupt, or incomplete
- Files: `backend/app/services/brain_mapper.py` (lines 180-186)
- Risk: Silent fallback to defaults produces meaningless results
- Recommendation: Add tests forcing fallback path and validating mock baselines are used

---

*Concerns audit: 2026-04-05*
