# Codebase Structure

**Analysis Date:** 2026-04-05

## Directory Layout

```
tribe-uiux/
├── backend/                    # Python FastAPI application
│   ├── app/                    # Main application package
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI app setup, middleware, routing
│   │   ├── config.py          # Pydantic settings (paths, mode flags, API keys)
│   │   ├── dependencies.py    # Singleton TRIBE model loading
│   │   ├── models/            # Data models and schemas
│   │   │   ├── __init__.py
│   │   │   ├── schemas.py     # Pydantic request/response models
│   │   │   └── brain_regions.py  # UX metric mappings, Destrieux atlas labels
│   │   ├── routers/           # API endpoint handlers
│   │   │   ├── __init__.py
│   │   │   ├── upload.py      # POST /api/upload endpoint
│   │   │   ├── jobs.py        # GET /api/jobs/{id} endpoint
│   │   │   ├── health.py      # GET /api/health endpoint
│   │   │   ├── analyze_url.py # POST /api/analyze/url (screenshot + analyze)
│   │   │   └── compare.py     # POST /api/analyze/compare (dual file analysis)
│   │   └── services/          # Core business logic
│   │       ├── __init__.py
│   │       ├── pipeline.py    # Orchestrates full analysis pipeline
│   │       ├── job_manager.py # In-memory job storage and state management
│   │       ├── media_converter.py  # Image→video, ffmpeg-based
│   │       ├── tribe_runner.py     # TRIBE v2 inference (mock/real/RunPod)
│   │       ├── tribe_compat.py     # Platform-specific TRIBE setup
│   │       ├── brain_mapper.py     # Atlas mapping, z-score normalization
│   │       └── llm_interpreter.py  # Claude API calls for analysis
│   ├── data/                  # Local data directory
│   │   ├── uploads/           # User-uploaded media files (runtime, gitignored)
│   │   └── baselines/         # Population baseline statistics (JSON)
│   ├── cache/                 # TRIBE v2 cache (gitignored)
│   │   └── tribev2_weights/   # Model weights
│   ├── tests/                 # Test suite (pytest)
│   ├── requirements.txt       # Python dependencies
│   ├── run.py                 # Entry point: uvicorn on port 9100
│   └── .env.example           # Example environment configuration
│
├── frontend/                  # Vanilla HTML/CSS/JS static files
│   ├── index.html             # Main HTML document (all views)
│   ├── css/
│   │   ├── main.css           # Global styles, design tokens, layout
│   │   └── components.css     # Component-specific styles
│   ├── js/
│   │   ├── app.js             # Main controller, view switching, state machine
│   │   ├── upload.js          # File upload, drag-drop, URL input
│   │   ├── polling.js         # Job status polling (2s intervals)
│   │   ├── results.js         # Results view rendering, charts
│   │   ├── brain-view.js      # Canvas-based cortical heatmap
│   │   ├── compare.js         # Side-by-side design comparison
│   │   └── charts.js          # Chart utilities (timeseries, gauges)
│   └── assets/                # Images, icons (if any)
│
├── docker/
│   └── Dockerfile             # Multi-stage build for backend
│
├── docker-compose.yml         # Local development orchestration
├── .dockerignore               # Exclude from Docker image
├── .gitignore                 # Exclude uploads, cache, env
├── CLAUDE.md                  # Developer instructions (architecture, setup)
├── .env.example               # Template for .env (API keys, settings)
└── README.md                  # Project overview
```

## Directory Purposes

**backend/app/:**
- Purpose: Core FastAPI application code
- Contains: HTTP routing, business logic, models, configuration
- Key files: `main.py` (app setup), `config.py` (settings), routers/, services/

**backend/app/routers/:**
- Purpose: HTTP endpoint handlers (one per router responsibility)
- Contains: Request validation, file handling, response formatting
- Key pattern: Each router defines one APIRouter with related endpoints

**backend/app/services/:**
- Purpose: Stateless, domain-specific business logic
- Contains: Media processing, neural inference, atlas mapping, LLM analysis
- Key pattern: Each service module exports pure functions or singletons

**backend/app/models/:**
- Purpose: Data structure definitions and mappings
- Contains: Pydantic schemas (request/response validation), brain anatomy mappings
- Key files: `schemas.py` (API contracts), `brain_regions.py` (UX metric groups)

**backend/data/:**
- Purpose: Local data storage (runtime and reference)
- Structure: `uploads/` (user files, gitignored), `baselines/` (population stats, committed)
- Note: Baselines are static; `baselines.json` generated once via `scripts/generate_baselines.py`

**backend/cache/:**
- Purpose: TRIBE v2 model cache (model weights, feature cache)
- Status: Generated at runtime, large files, gitignored
- Location: Configured via `settings.tribe_cache_dir` (default: `./cache`)

**frontend/:**
- Purpose: Static HTML/CSS/JS served by FastAPI
- Structure: Single `index.html` with all view containers, CSS namespaced by view
- JS: Vanilla modules (no framework), each module exports singleton with init() and public API

**frontend/js/:**
- Purpose: Client-side state, view rendering, API communication
- Pattern: Module pattern (IIFE) → App, Upload, Polling, Results, BrainView, Compare are singletons
- Key dependency: App is central orchestrator; others depend on App.switchView()

**frontend/css/:**
- Purpose: Visual design and layout
- Pattern: CSS custom properties for colors/fonts, BEM-like component naming
- File split: `main.css` (tokens, global), `components.css` (views, controls)

## Key File Locations

**Entry Points:**

- Backend: `backend/run.py` — Starts uvicorn on 0.0.0.0:9100
- Frontend: `frontend/index.html` — Main HTML document
- Frontend init: `frontend/js/app.js` — App.init() called on DOMContentLoaded

**Configuration:**

- `backend/app/config.py` — All settings via pydantic-settings + .env
- `.env.example` — Template (copy to `.env` and fill in API keys)
- `.dockerignore` — What to exclude from Docker build

**Core Logic:**

**Media Processing:**
- `backend/app/services/media_converter.py` — Image→video conversion (ffmpeg)

**Neural Analysis:**
- `backend/app/services/tribe_runner.py` — TRIBE v2 inference wrapper
- `backend/app/services/brain_mapper.py` — Destrieux atlas mapping, z-score computation

**LLM Integration:**
- `backend/app/services/llm_interpreter.py` — Claude API calls with fallback

**Pipeline:**
- `backend/app/services/pipeline.py` — Orchestrates end-to-end analysis

**State Management:**
- `backend/app/services/job_manager.py` — In-memory job store

**Testing:**

- `backend/tests/` — pytest suite (currently sparse)

## Naming Conventions

**Files:**

- **Python:** snake_case.py (e.g., `tribe_runner.py`, `brain_mapper.py`)
- **JavaScript:** camelCase.js (e.g., `app.js`, `uploadFile()`)
- **CSS:** main.css, components.css (flat structure)
- **Config:** lowercase with dashes or underscores (`.env.example`, `docker-compose.yml`)

**Directories:**

- Plural for collections: `backend/app/routers/`, `backend/app/services/`, `backend/app/models/`
- Lowercase snake_case: `data/`, `uploads/`, `baselines/`

**Python Code:**

- **Classes:** PascalCase (e.g., `Job`, `Settings`, `UXMetrics`)
- **Functions:** snake_case (e.g., `create_job()`, `compute_ux_metrics()`, `run_inference()`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `MAX_JOBS`, `JOB_TTL_SECONDS`, `ALLOWED_IMAGE`)
- **Modules:** snake_case (e.g., `job_manager`, `brain_mapper`)

**JavaScript Code:**

- **Modules/Singletons:** PascalCase (e.g., `App`, `Upload`, `BrainView`)
- **Functions:** camelCase (e.g., `switchView()`, `startProcessing()`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `STAGE_TITLES`, `MAX_FILE_SIZE`)
- **Private:** Prefix with _ (e.g., `_poll()`, `_formatMetrics()`)
- **DOM IDs:** kebab-case (e.g., `#upload-container`, `#progress-bar`)

**Pydantic Models:**

- **Request/Response:** PascalCase + Response/Request suffix where ambiguous (e.g., `UploadResponse`, `JobResponse`)
- **Data Classes:** PascalCase (e.g., `Job`, `UXMetrics`, `TemporalHotspot`)

## Where to Add New Code

**New Feature (e.g., new UX metric):**

1. **Define metric mapping:**
   - Edit `backend/app/models/brain_regions.py` → add to `UX_REGION_GROUPS` dict
   - Add color constant in `frontend/css/main.css` (--metric-name)

2. **Backend computation:**
   - Edit `backend/app/services/brain_mapper.py` → add to `compute_ux_metrics()` return
   - Update `backend/app/models/schemas.py` → add field to `UXMetrics`

3. **Frontend display:**
   - Edit `frontend/js/results.js` → add rendering logic to `renderCharts()`
   - Edit `frontend/css/components.css` → add metric-specific styles

**New API Endpoint:**

1. Create new file in `backend/app/routers/new_feature.py`
2. Define APIRouter with @router.post() or @router.get()
3. Register in `backend/app/main.py` → `app.include_router(new_feature.router, prefix="/api")`
4. Add Pydantic schema to `backend/app/models/schemas.py` if needed

**New Service:**

1. Create `backend/app/services/new_service.py`
2. Export public functions (or singleton class with init-like pattern)
3. Import in `backend/app/services/pipeline.py` if part of pipeline
4. Or call from router directly if request-scoped

**Frontend Module:**

1. Create `frontend/js/module_name.js` as IIFE singleton
2. Export `.init()` (called from App.init() or lazily), and public API
3. Register event listeners in `.init()`
4. Call `App.switchView()` or other App methods for navigation
5. Import/call in `frontend/js/app.js` or other modules

**Test:**

1. Create `backend/tests/test_service_name.py`
2. Import service and use pytest fixtures
3. Run: `cd backend && pytest`

## Special Directories

**backend/cache/:**
- Purpose: TRIBE v2 model weights and cached features
- Generated: On first run (model download from HuggingFace)
- Committed: No (large, gitignored)
- Cleanup: Manual; can delete to re-download model

**backend/data/uploads/:**
- Purpose: User-uploaded media files (images, videos, audio)
- Generated: On each upload
- Committed: No (gitignored)
- Cleanup: TTL cleanup in job_manager.py deletes old uploads; can manually clear

**backend/data/baselines/:**
- Purpose: Population baseline statistics (JSON with mean/std per metric)
- Generated: Once via `scripts/generate_baselines.py` (requires mock TRIBE runs on representative data)
- Committed: Yes (reference data)
- Format: `{"visual_processing": {"mean": 0.35, "std": 0.12}, ...}`

**frontend/css/, frontend/js/:**
- Purpose: Cached by FastAPI with Cache-Control headers
- Served via: CachedStaticFiles in main.py (max-age=3600)
- Breakage: Requires server restart to deploy new CSS/JS

---

*Structure analysis: 2026-04-05*
