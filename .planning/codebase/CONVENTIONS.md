# Coding Conventions

**Analysis Date:** 2026-04-05

## Naming Patterns

**Files:**
- Backend Python: `snake_case` (e.g., `brain_mapper.py`, `job_manager.py`, `tribe_runner.py`)
- Frontend JavaScript: `snake_case` (e.g., `app.js`, `upload.js`, `polling.js`, `brain-view.js`, `charts.js`)
- Directories: `snake_case` (e.g., `routers/`, `services/`, `models/`)

**Functions (Python):**
- Private/internal: `_leading_underscore` (e.g., `_safe_filename()`, `_load_atlas()`, `_mock_inference()`)
- Public: regular `snake_case` (e.g., `run_inference()`, `compute_ux_metrics()`, `generate_analysis()`)
- Async endpoints: `async def` declared (e.g., `async def serve_index()`, `async def upload_file()`)

**Functions (JavaScript):**
- Use camelCase with descriptive names (e.g., `init()`, `setData()`, `renderFrictionScore()`, `startProcessing()`)
- Module pattern uses IIFE with `const ModuleName = (() => { ... })()` structure
- Event handlers inline or as named functions within modules (e.g., `addEventListener('click', () => { ... })`)

**Variables (Python):**
- Constants: `UPPERCASE_WITH_UNDERSCORES` (e.g., `MAX_FILE_SIZE`, `ALLOWED_IMAGE`, `STAGE_ORDER`)
- Module-level state: `_leading_underscore` (e.g., `_jobs`, `_vertex_labels_lh`)
- Regular variables: `snake_case` (e.g., `job_id`, `media_type`, `z_scores`)

**Variables (JavaScript):**
- Constants: `UPPERCASE_WITH_UNDERSCORES` (e.g., `MAX_FILE_SIZE`, `ALLOWED_EXTENSIONS`, `STAGE_TITLES`)
- Module-level state: declare at IIFE scope (e.g., `let selectedFile = null`, `let intervalId = null`)
- Regular variables: `camelCase` (e.g., `jobId`, `mediaType`, `activationData`)

**Types (Python):**
- Pydantic models: `PascalCase` (e.g., `UploadResponse`, `JobResponse`, `UXMetrics`)
- Dataclasses: `PascalCase` (e.g., `Job` in `job_manager.py`)
- Type hints: use `|` for unions (e.g., `dict[str, float]`, `list[float]`, `Path | None`)

## Code Style

**Formatting (Python):**
- No explicit formatter configured; follows PEP 8 conventions
- Indentation: 4 spaces
- Line length: typically under 100 characters
- Imports organized: standard library → third-party → local (example in `main.py`)

**Formatting (JavaScript):**
- No explicit formatter configured; follows typical JS conventions
- Indentation: 2 spaces
- Semicolons: used
- Arrow functions preferred in callbacks

**Linting (Python):**
- No explicit linter configured (pytest/pylint not in requirements.txt)
- Manual inspection of error handling and type consistency

**Linting (JavaScript):**
- No ESLint or similar configured (package.json has no eslint dev dependency)
- Playwright installed for E2E testing but tests not implemented

## Import Organization

**Order (Python):**
1. Standard library (`pathlib`, `uuid`, `json`, `logging`, `time`)
2. Third-party (`fastapi`, `pydantic_settings`, `numpy`, `anthropic`)
3. Local app imports (`from app.config`, `from app.models`, `from app.services`)

Example from `main.py`:
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import upload, jobs, health, analyze_url, compare
```

**Order (JavaScript):**
- All code is IIFE-based modules; no explicit imports (vanilla JS)
- Dependencies loaded via `<script>` tags in HTML (Chart.js loaded dynamically in `charts.js`)
- Module ordering: Core (`app.js`) → Input (`upload.js`, `polling.js`) → Visualization (`brain-view.js`, `results.js`, `charts.js`)

**Path Aliases (None):**
- Backend: no aliases; all imports are relative to `app/` root (e.g., `from app.config`)
- Frontend: no aliases; all modules are loaded in global scope

## Error Handling

**Python Pattern:**
- FastAPI endpoints raise `HTTPException` with specific status codes and detail messages
  ```python
  if not isAllowedFile(file):
      raise HTTPException(status_code=400, detail="Unsupported file type: ...")
  ```
- Background pipeline wraps work in try/except, captures traceback on failure
  ```python
  try:
      # ... pipeline steps
  except Exception as e:
      jm.update_job(job.id, status=jm.FAILED, error=f"{type(e).__name__}: {e}\n{traceback.format_exc()}")
  ```
- Utility functions raise exceptions (e.g., `ValueError`, `RuntimeError`) for invalid inputs
- Imports are conditionally wrapped (e.g., `_load_atlas()` catches exception and falls back to mock mappings)

**JavaScript Pattern:**
- User-triggered actions (upload, polling) catch errors and display user-friendly messages
  ```javascript
  try {
      const resp = await fetch('/api/upload', { ... });
      if (!resp.ok) throw new Error(err.detail || 'Upload failed');
  } catch (err) {
      showUploadError('Upload error: ' + err.message);
  }
  ```
- Polling has graceful degradation: after 5 consecutive errors, warn user; after 10, stop polling
- No error thrown from event handlers; errors logged to console or shown in UI
- Null/undefined checks use guard clauses (e.g., `if (!currentJobId) return;`)

## Logging

**Framework (Python):** `logging` module from standard library

**Patterns:**
- Minimal explicit logging; mostly via print statements in `main.py` for startup/shutdown
  ```python
  print("TRIBE v2 model loaded")
  print("Running in MOCK mode (no real TRIBE inference)")
  ```
- Service layer (`llm_interpreter.py`) uses `logger = logging.getLogger(__name__)` for info-level logs
  ```python
  logger.info("No API key configured — using mock analysis")
  ```
- Error messages captured in Job object, returned via API, displayed in frontend

**Framework (JavaScript):** Console only (no logging library)

**Patterns:**
- Debug info logged to `console.error()` in error handlers
  ```javascript
  console.error('Polling error:', err);
  ```
- No structured logging; errors displayed in UI via DOM updates

## Comments

**When to Comment (Python):**
- Module docstrings at top of file explaining purpose
  ```python
  """Map TRIBE v2 cortical vertex predictions to UX-relevant metrics."""
  ```
- Function docstrings for public APIs with Args/Returns
  ```python
  def run_inference(video_path: Path | None = None, audio_path: Path | None = None) -> tuple[np.ndarray, list[float]]:
      """
      Run TRIBE v2 inference on a media file.
      
      Returns:
          predictions: numpy array of shape (n_timesteps, 20484)
          timestamps: list of float timestamps in seconds
      """
  ```
- Inline comments for non-obvious logic
  ```python
  # Ensure ffmpeg is findable on Windows
  if sys.platform == "win32":
  ```

**When to Comment (JavaScript):**
- File-level JSDoc block explaining module purpose
  ```javascript
  /**
   * Main application controller — view switching and orchestration.
   */
  ```
- Function comments for complex logic
  ```javascript
  function generateBrainLayout(w, h) {
      // Create a brain-shaped distribution of ~1024 points
      // (matches the downsampled brain_activations from backend — every 20th vertex)
  ```
- Inline comments for non-obvious calculations or browser quirks

**JSDoc/TSDoc (None):**
- JavaScript uses basic JSDoc for file headers; no formal parameter/return docs
- Python uses docstrings but not in strict Google/NumPy format

## Function Design

**Size (Python):**
- Most functions 10-50 lines
- Larger orchestration functions (e.g., `run_pipeline()`) 80+ lines but well-structured with clear step comments
- Prefer small helper functions with `_leading_underscore` for internal use (e.g., `_safe_filename()`, `_mock_inference()`)

**Parameters:**
- Positional only for required inputs
- Keyword arguments with type hints for optional/config params
- Example: `def compute_ux_metrics(predictions: np.ndarray, timestamps: list[float]) -> dict:`

**Return Values:**
- Single return when possible; tuples for related values (e.g., `tuple[np.ndarray, list[float]]` from `run_inference()`)
- Dicts for structured multi-field returns (e.g., `compute_ux_metrics()` returns dict with 'metrics', 'z_scores', 'temporal_hotspots', etc.)
- Optional types declared explicitly (e.g., `Job | None` from `get_job()`)

**Size (JavaScript):**
- Module functions typically 5-30 lines
- Logic broken into smaller pieces within IIFE
- Pure functions for utility calculations (e.g., `interpretZ()`, `formatSize()`)

**Parameters (JavaScript):**
- Minimalist: pass only required data
- Event handlers often capture state from closure rather than parameters

**Return Values (JavaScript):**
- Single values or objects (e.g., `{ init, clearFile }` module API)
- Promises from async operations (e.g., `loadChartJs()` returns Promise)

## Module Design

**Exports (Python):**
- Each service module exports main functions (e.g., `brain_mapper.py` exports `compute_ux_metrics()`, `interpret_z_score()`)
- Utility modules export data structures (e.g., `brain_regions.py` exports `UX_REGION_GROUPS`, `UX_METRIC_LABELS`)
- Job state exported as constants (e.g., `CREATED`, `CONVERTING`, `COMPLETED`)

**Exports (JavaScript):**
- Module pattern exposes only public API via returned object
  ```javascript
  return { init, clearFile };  // Only these are public
  ```
- All module state remains private within IIFE closure
- Views are managed via DOM IDs (centralized in `app.js`)

**Barrel Files:**
- Python: `routers/__init__.py` and `services/__init__.py` are empty (no barrel exports)
- Imports are explicit: `from app.routers import upload, jobs, health, analyze_url, compare`

**Initialization Patterns (Python):**
- Singletons created at module level or in dependency injection (`dependencies.py`)
- Settings loaded from `config.py` at import time
- Job store initialized as empty dict in `job_manager.py`

**Initialization Patterns (JavaScript):**
- IIFE modules auto-execute but delay DOM queries until `init()` is called
- App initialization on `DOMContentLoaded` event in `app.js`
- Lazy initialization where needed (e.g., `BrainView.init()` on first result render)

---

*Convention analysis: 2026-04-05*
