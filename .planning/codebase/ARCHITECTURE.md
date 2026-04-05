# Architecture

**Analysis Date:** 2026-04-05

## Pattern Overview

**Overall:** Layered client-server pipeline architecture with background job processing and real-time polling.

**Key Characteristics:**
- Asynchronous pipeline orchestration with in-memory job state management
- Stateless HTTP API layer exposing job endpoints and media upload
- Domain-driven backend services (media conversion, neural inference, atlas mapping, LLM analysis)
- Vanilla JavaScript frontend with view-based state machine and polling-driven updates
- Brain visualization via Canvas 2D rendering with temporal interpolation

## Layers

**API/HTTP Layer:**
- Purpose: Expose REST endpoints for upload, job polling, URL analysis, and design comparison
- Location: `backend/app/main.py`, `backend/app/routers/`
- Contains: FastAPI application setup, middleware (CORS, gzip), static file serving, route registration
- Depends on: Schemas (Pydantic models), service layer
- Used by: Frontend (fetch calls), external clients

**Router Layer:**
- Purpose: Handle specific API operations (upload, jobs, health, analyze_url, compare)
- Location: `backend/app/routers/` (`upload.py`, `jobs.py`, `health.py`, `analyze_url.py`, `compare.py`)
- Contains: Endpoint handlers, file sanitization, request validation
- Depends on: Job manager, pipeline, schemas
- Used by: FastAPI application (via include_router)

**Job Management Layer:**
- Purpose: Track job state, lifecycle, and results in memory
- Location: `backend/app/services/job_manager.py`
- Contains: Job dataclass definition, in-memory job store (_jobs dict), job CRUD operations, TTL cleanup
- Depends on: None (self-contained)
- Used by: Router layer, pipeline service

**Pipeline Orchestration Layer:**
- Purpose: Coordinate sequential execution of media conversion → inference → mapping → interpretation
- Location: `backend/app/services/pipeline.py`
- Contains: run_pipeline() function orchestrating state transitions (CREATED → CONVERTING → PREDICTING → MAPPING → INTERPRETING → COMPLETED/FAILED)
- Depends on: Job manager, tribe_runner, brain_mapper, llm_interpreter, media_converter
- Used by: Router layer (via submit_pipeline in job_manager), background thread pool

**Domain Services Layer:**
- Purpose: Encapsulate core neural analysis logic and transformations

**Media Conversion:**
- Location: `backend/app/services/media_converter.py`
- Converts images to scrolling videos (ffmpeg-based), validates video/audio formats
- Dependencies: ffmpeg CLI

**Neural Inference:**
- Location: `backend/app/services/tribe_runner.py`, `backend/app/services/tribe_compat.py`
- Supports three modes: mock (synthetic data), real (local TRIBE v2), RunPod (remote serverless)
- Returns: (predictions: ndarray[n_timesteps, 20484], timestamps: list[float])

**Brain Mapping:**
- Location: `backend/app/services/brain_mapper.py`
- Maps 20484 cortical vertices to 6 UX-relevant metric groups via Destrieux atlas
- Computes z-scores against population baselines
- Returns: metrics, z_scores, temporal_hotspots, timeseries, brain_activations

**LLM Interpretation:**
- Location: `backend/app/services/llm_interpreter.py`
- Calls Claude API with z-score metrics and design image (multimodal)
- Falls back to mock analysis when API key absent
- Returns: (analysis: str, friction_score: float)

**Models/Schema Layer:**
- Purpose: Define data structures and type contracts
- Location: `backend/app/models/` (`schemas.py`, `brain_regions.py`)
- Contains: Pydantic request/response models (UploadResponse, JobResponse, etc.), UX region group mappings, z-score interpretation rules
- Depends on: None
- Used by: Router layer, service layer

**Configuration Layer:**
- Purpose: Centralize settings from environment
- Location: `backend/app/config.py`
- Contains: Settings class (pydantic-settings), paths, TRIBE mode flag, API keys, media conversion parameters
- Depends on: pydantic-settings
- Used by: All layers

**Dependency Injection Layer:**
- Purpose: Manage singleton TRIBE model instance
- Location: `backend/app/dependencies.py`
- Contains: get_tribe_model() function (loads once, caches, applies platform-specific patches)
- Depends on: Config, tribe_compat
- Used by: Main.py lifespan context

**Frontend State & View Layer:**
- Purpose: Manage application state machine and view switching
- Location: `frontend/js/app.js`
- Contains: View state (upload, processing, results, compare), view switching logic, history management
- Depends on: Upload, Polling, Results, Compare, BrainView modules
- Used by: All frontend modules

**Frontend Upload Module:**
- Purpose: Handle file selection and URL input
- Location: `frontend/js/upload.js`
- Contains: Drag-and-drop, file validation, mode toggling (file vs URL), POST to /api/upload or /api/analyze/url
- Depends on: App module

**Frontend Polling Module:**
- Purpose: Long-poll job status and update UI
- Location: `frontend/js/polling.js`
- Contains: GET /api/jobs/{id} polling every 2 seconds, progress bar updates, stage indicator
- Depends on: App module (switchView)
- Used by: Results display

**Frontend Results Module:**
- Purpose: Render analysis results and visualizations
- Location: `frontend/js/results.js`
- Contains: Friction score rendering, LLM analysis text display, chart rendering, timestep slider
- Depends on: BrainView, Charts modules
- Used by: App module

**Frontend Brain Visualization:**
- Purpose: Render interactive 2D cortical heatmap
- Location: `frontend/js/brain-view.js`
- Contains: Canvas-based brain shape generation, vertex position layout, heatmap color mapping, animation loop
- Depends on: Charts (for color utilities)

**Frontend Compare Module:**
- Purpose: Side-by-side comparison of two designs
- Location: `frontend/js/compare.js`
- Contains: Dual-file upload, dual job polling, diff metrics visualization

## Data Flow

**Analysis Pipeline (Primary Flow):**

1. **Upload** → User selects file or URL in upload view
2. **POST /api/upload** or **POST /api/analyze/url** → Router sanitizes, saves file, creates Job, submits to pipeline
3. **run_pipeline() starts in background thread** → Job transitions: CREATED
4. **Media Conversion** (if non-mock) → Image → scroll video (ffmpeg), validate video/audio → Job: CONVERTING
5. **TRIBE Inference** → Media → TRIBE v2 (mock/real/RunPod) → cortical vertex activations [n_timesteps, 20484] → Job: PREDICTING
6. **Brain Mapping** → Activations → Destrieux atlas mapping → UX metrics + z-scores vs baselines → Job: MAPPING
7. **LLM Interpretation** → Metrics + image → Claude API → analysis text + friction score → Job: INTERPRETING
8. **Complete** → Job: COMPLETED, all results stored in Job object

**Frontend Polling (Discovery Flow):**

1. Upload endpoint returns `{job_id: "xyz"}`
2. App.startProcessing(jobId) → switch to processing view
3. Polling.start() → GET /api/jobs/xyz every 2s
4. On each poll: Update progress bar, stage indicator, check if status === 'completed' or 'failed'
5. When completed: Polling.stop() → App.showResults(jobData) → Results.render()
6. Results.render() initializes BrainView, renders charts, displays LLM analysis

**Comparison Flow:**

1. User selects Design A, clicks "Compare with another"
2. Upload form expands to compare mode, accepts Design B
3. POST /api/analyze/compare with both files → Returns {job_id_a, job_id_b}
4. Compare module polls both jobs in parallel
5. When both complete: Render side-by-side metrics, diff indicators

**State Management:**

- **Backend:** Job objects in-memory (_jobs dict in job_manager.py), updated via update_job() calls, TTL cleanup after 30min
- **Frontend:** View state in App module, polling state in Polling module, render state in Results/BrainView/Compare modules
- **Client-Server:** Via polling — frontend pulls job state, no push mechanism

## Key Abstractions

**Job:**
- Purpose: Encapsulates a single analysis task from upload to completion
- Defined in: `backend/app/services/job_manager.py` (Job dataclass)
- Pattern: Value object with mutable state; stores all intermediate and final results
- Fields: id, status, media_type, progress, results (metrics, z_scores, analysis, friction_score), error, timestamps

**UX Metric Groups:**
- Purpose: Map anatomical brain regions to user-experience concerns
- Defined in: `backend/app/models/brain_regions.py` (UX_REGION_GROUPS dict)
- Pattern: Substring matching on Destrieux atlas labels to assign vertices to metrics
- Groups: visual_processing, object_recognition, reading_language, attention_salience, cognitive_load, emotional_response

**Z-Score Interpretation:**
- Purpose: Standardize and interpret neural metrics relative to population baselines
- Defined in: `backend/app/models/brain_regions.py`, `backend/app/services/brain_mapper.py`
- Pattern: (value - mean) / std; maps ranges to severity (< -1.5: extreme low, 1.5-2.5: elevated, > 2.5: extreme)
- Used by: LLM prompt for context on metric severity

**Temporal Hotspots:**
- Purpose: Identify peak activation moments in time-series
- Defined in: `backend/app/services/brain_mapper.py`
- Pattern: Sorted list of (timestamp, metric, value, section) tuples representing anomalies
- Used by: LLM analysis (what happened when), frontend visualization

**Brain Activations (Downsampled):**
- Purpose: Reduced-resolution vertex activations for efficient frontend rendering
- Created in: `backend/app/services/brain_mapper.py` (every 20th vertex)
- Pattern: List of lists [timestep][vertex_index], ~1024 vertices per timestep
- Used by: BrainView.js canvas rendering

## Entry Points

**API Entry Point:**
- Location: `backend/app/main.py` → FastAPI app
- Triggers: uvicorn on port 9100 (started via `backend/run.py`)
- Responsibilities: Mount static files, register routers, manage lifespan (startup/shutdown)

**Upload Endpoint:**
- Location: `backend/app/routers/upload.py` → POST /api/upload
- Triggers: Frontend form submission (upload.js)
- Responsibilities: Sanitize filename, save file, create job, submit pipeline

**URL Analysis Endpoint:**
- Location: `backend/app/routers/analyze_url.py` → POST /api/analyze/url
- Triggers: Frontend URL input (upload.js)
- Responsibilities: Screenshot URL via Playwright, save image, create job, submit pipeline

**Compare Endpoint:**
- Location: `backend/app/routers/compare.py` → POST /api/analyze/compare
- Triggers: Frontend compare mode (compare.js)
- Responsibilities: Save both files, create two jobs, submit both pipelines, return dual job IDs

**Jobs Polling Endpoint:**
- Location: `backend/app/routers/jobs.py` → GET /api/jobs/{job_id}
- Triggers: Polling.js every 2 seconds
- Responsibilities: Return current job state (status, progress, results)

**Health Endpoint:**
- Location: `backend/app/routers/health.py` → GET /api/health
- Triggers: Frontend startup check (app.js)
- Responsibilities: Return backend status, TRIBE mode, model loaded flag

**Frontend Entry Point:**
- Location: `frontend/index.html`
- Triggers: Browser fetch of http://localhost:9100/
- Responsibilities: Load CSS, JS, initialize App module

**App.js Initialization:**
- Location: `frontend/js/app.js` → App.init()
- Triggers: DOMContentLoaded
- Responsibilities: Initialize Upload, Compare, attach event listeners, check backend health

## Error Handling

**Strategy:** Try-catch at pipeline level; graceful degradation with fallbacks

**Patterns:**

- **Pipeline Errors:** Any exception in run_pipeline() is caught, job marked FAILED, error message stored in job.error
- **Media Conversion:** ffmpeg errors → HTTPException 400; missing ffmpeg checked at pipeline start
- **TRIBE Inference:** Mock mode on error (if real model fails), or RunPod timeout → retry logic in tribe_runner.py
- **Brain Mapping:** Graceful fallback to hardcoded mock region assignments if nilearn fails
- **LLM Analysis:** Fallback to mock analysis if API key missing or API call fails
- **Frontend Upload:** File validation (size, extension) before POST; HTTP error responses displayed in error-banner elements
- **Frontend Polling:** Consecutive errors threshold (3?) triggers graceful fallback, cancel button always available

## Cross-Cutting Concerns

**Logging:** Python logging via app.config and service modules; frontend console.log for debug

**Validation:**
- Backend: Pydantic schemas enforce request shapes; filename sanitization prevents traversal; ffmpeg format validation
- Frontend: File extension whitelist, max file size (100MB), URL regex validation

**Authentication:** None (open endpoint); could add CORS by IP or API key in future

**Media Type Classification:** Extension-based in upload.py (image/video/audio), reused in compare.py

**Cache Management:** TRIBE v2 cache in backend/cache/ (model weights, video features); frontend static files cached via Cache-Control headers

**Resource Limits:** Max 100 concurrent jobs in memory; jobs auto-cleanup after 30 min TTL or when limit exceeded

---

*Architecture analysis: 2026-04-05*
