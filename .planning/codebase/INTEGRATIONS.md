# External Integrations

**Analysis Date:** 2026-04-05

## APIs & External Services

**LLM Analysis:**
- Anthropic Claude API - Interprets z-scored neural metrics, generates UX recommendations
  - SDK/Client: `anthropic` 0.40.0+
  - Auth: `ANTHROPIC_API_KEY` environment variable
  - Implementation: `backend/app/services/llm_interpreter.py`
  - Multimodal: Supports image attachment (base64-encoded screenshot) alongside metrics
  - Model: `claude-sonnet-4-20250514`
  - Fallback: Mock analysis generated when no API key configured

**URL Screenshot Capture:**
- Playwright (Chromium browser automation) - Captures full-page screenshots of URLs
  - SDK/Client: `playwright` 1.59.1+ (async_api)
  - Implementation: `backend/app/routers/analyze_url.py::_screenshot_url()`
  - Viewport: 1440x900, captures full page (capped at 5000px height)
  - Timeout: 20 seconds for page load, waits 2s for lazy content
  - Browser: Headless Chromium (installed via `playwright install`)

**GPU Inference (Optional):**
- RunPod Serverless API - Distributed GPU inference for TRIBE v2 when local GPU unavailable
  - Endpoint: `https://api.runpod.ai/v2/{endpoint_id}/runsync` (sync) and `/status/{job_id}` (async)
  - Auth: `RUNPOD_API_KEY` header (`Bearer` token)
  - Config: `RUNPOD_ENDPOINT_ID`, `RUNPOD_API_KEY` environment variables
  - Implementation: `backend/app/services/tribe_runner.py::_runpod_inference()`
  - Input: Base64-encoded media (video/audio/image) + media_type
  - Output: JSON with `predictions` (float array) and `timestamps` (list)
  - Polling: Up to 120 polls at 5-second intervals (10-minute timeout) for async jobs
  - Used when: Both `runpod_endpoint_id` and `runpod_api_key` are set in config

## Data Storage

**Databases:**
- None - Application is stateless; job state maintained in-memory (ThreadPoolExecutor)

**File Storage:**
- Local filesystem only
  - Uploads: `backend/data/uploads/` - User-uploaded media and screenshots
  - Baselines: `backend/data/baselines/` - Population baseline statistics (JSON)
  - Cache: `backend/cache/` (configurable via `TRIBE_CACHE_DIR`) - TRIBE model cache, HuggingFace models
  - Docker volumes persist these across restarts

**Caching:**
- HuggingFace Model Cache: `.cache/huggingface/` mounted in Docker
- TRIBE v2 Model Cache: `backend/cache/` (if real inference enabled)
- HTTP Cache-Control: Frontend static files (`/css`, `/js`, `/assets`) cached at 3600s (via `CachedStaticFiles` middleware)

## Authentication & Identity

**Auth Provider:**
- None - No user authentication implemented
- All endpoints are public (no auth guards, CORS allows all origins)
- No session or API key mechanism for user isolation

## Monitoring & Observability

**Error Tracking:**
- None - Errors logged to stdout/stderr via Python logging

**Logs:**
- Python standard `logging` module - Configured via `logging.getLogger(__name__)` in services
- Log locations: Container stdout/stderr (accessible via `docker logs`)
- Levels observed: `logger.info()`, `logger.error()`
- No centralized log aggregation

**Health Check:**
- `GET /api/health` - Simple endpoint returning status (Dockerfile HEALTHCHECK probes this)

## CI/CD & Deployment

**Hosting:**
- Docker Compose (local/development) - Binds to `localhost:9100`
- Docker image deployable to any container registry
- Unresolved Dockerfile merge conflict suggests in-progress multi-config setup (CUDA vs. slim)

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or similar configured

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_API_KEY` - For real LLM analysis (optional; mock fallback if missing)

**Optional env vars:**
- `TRIBE_MOCK_MODE` (default: `true`) - Set `false` for real TRIBE v2 inference
- `TRIBE_DEVICE` (default: `auto`) - `cuda` or `cpu`
- `TRIBE_CACHE_DIR` (default: `./cache`)
- `RUNPOD_ENDPOINT_ID` - RunPod endpoint ID for distributed inference
- `RUNPOD_API_KEY` - RunPod API token
- `SCROLL_SPEED_PX_PER_SEC` (default: 200)
- `VIEWPORT_WIDTH` (default: 1920), `VIEWPORT_HEIGHT` (default: 1080)

**Secrets location:**
- `.env` file at project root (loaded by Docker compose and FastAPI via `pydantic-settings`)
- File is in `.gitignore` (safe)
- Note: Contains `ANTHROPIC_API_KEY` and RunPod credentials — never commit

## Webhooks & Callbacks

**Incoming:**
- None - No webhook receivers implemented

**Outgoing:**
- None - No webhook senders

## Media Processing Pipeline

**FFmpeg Integration:**
- Image-to-video conversion: `backend/app/services/media_converter.py`
  - Converts tall screenshots to scrolling videos (simulates user scrolling)
  - Uses `ffmpeg` crop filter with time-varying y offset
  - Ken Burns effect fallback for images shorter than viewport
  - Output: MP4 (libx264, yuv420p)
- Media validation: ffprobe for dimension/codec inspection
- Executed via subprocess.run (sync), ffmpeg installed in container

## Data Flow with External Services

**Standard Upload → Analysis Pipeline:**

1. User uploads media → `POST /api/upload` (`backend/app/routers/upload.py`)
2. Saved to `backend/data/uploads/`
3. Job created and queued (`backend/app/services/job_manager.py`)
4. Pipeline runs in background thread (`backend/app/services/pipeline.py`):
   - **CONVERTING:** Image→video, audio/video validation (ffmpeg)
   - **PREDICTING:** TRIBE v2 inference (mock, local, or RunPod)
   - **MAPPING:** Vertex→region mapping (nilearn Destrieux Atlas)
   - **INTERPRETING:** Claude API call with z-scores + optional image
   - **COMPLETED:** Results stored in job object
5. Frontend polls `GET /api/jobs/{job_id}` for status and results

**URL Analysis Path:**

1. User submits URL → `POST /api/analyze/url` (`backend/app/routers/analyze_url.py`)
2. Playwright captures screenshot → saved to uploads
3. Same pipeline runs (treated as image input)

**Baseline Computation:**

- Population baselines stored in `backend/data/baselines/baselines.json`
- Loaded at runtime in `backend/app/services/brain_mapper.py::_load_baselines()`
- Generated offline via `scripts/generate_baselines.py` (not called by runtime)

---

*Integration audit: 2026-04-05*
