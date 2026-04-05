# Technology Stack

**Analysis Date:** 2026-04-05

## Languages

**Primary:**
- Python 3.11 / 3.12 - Backend API, brain analysis pipeline, media processing
- HTML/CSS/JavaScript (Vanilla) - Frontend UI, no frameworks

**Secondary:**
- Shell (Bash) - Docker entrypoints, scripts

## Runtime

**Environment:**
- Docker (CUDA 12.4.1 for GPU, or Python 3.12-slim for CPU-only)
- Python 3.11 (container: `nvidia/cuda:12.4.1-runtime-ubuntu22.04`) or 3.12 (slim variant)
- ffmpeg (system-level, installed via apt-get)

**Package Manager:**
- pip (Python)
- npm (Node.js, minimal use — Playwright only)
- Lockfile: `requirements.txt` (Python), `package-lock.json` (Node.js)

## Frameworks

**Core:**
- FastAPI 0.115.0+ - Async web framework, API routes, static file serving
- Uvicorn 0.30.0+ - ASGI server (port 9100)
- Pydantic 2.0+ (via pydantic-settings) - Settings/config validation

**Media Processing:**
- ffmpeg-python 0.2.0+ - Wrapper for ffmpeg CLI (image-to-video conversion, audio/video validation)
- ffprobe (system binary, via ffmpeg) - Media metadata extraction
- Playwright 1.59.1+ (Node.js package, installed via pip) - URL screenshot capture (Chromium headless)

**Brain Analysis:**
- nilearn 0.11.0+ - Destrieux Atlas mapping, brain region labels, coordinate transforms
- NumPy 1.26.0+ - Vertex array operations, z-score computation

**LLM Integration:**
- anthropic 0.40.0+ - Claude API client for UX analysis generation

**Testing/Dev:**
- (No test framework configured in `requirements.txt`)

## Key Dependencies

**Critical:**
- FastAPI (REST API) - All user-facing routes, async job handling
- NumPy (brain metrics) - Core computation for activation aggregation and z-scores
- nilearn (brain atlas) - Maps TRIBE v2 vertex indices to anatomical regions via Destrieux parcellation
- anthropic (LLM analysis) - Interprets neural metrics, generates marketing recommendations

**Infrastructure:**
- uvicorn (ASGI) - Production-ready HTTP server
- python-multipart (file uploads) - Handles multipart form data
- pydantic-settings (config) - Environment variable management via `.env` file
- ffmpeg-python (media) - Interface to ffmpeg for video/audio conversion

## Configuration

**Environment:**
- Configuration via `pydantic-settings` loading from `.env` file (located at project root for Docker compose)
- File: `backend/app/config.py` defines `Settings` class with defaults
- Key configs via env vars:
  - `TRIBE_MOCK_MODE` (default: `true`) - Toggle mock inference vs. real TRIBE v2
  - `TRIBE_DEVICE` (default: `auto`) - `cuda`, `cpu`, or `auto` for device detection
  - `TRIBE_CACHE_DIR` (default: `./cache`) - Model cache location
  - `ANTHROPIC_API_KEY` - Claude API key (optional; falls back to mock analysis)
  - `RUNPOD_ENDPOINT_ID` / `RUNPOD_API_KEY` - RunPod Serverless endpoint credentials (optional)
  - `SCROLL_SPEED_PX_PER_SEC` (default: 200) - Image scroll video speed
  - `VIEWPORT_WIDTH` (default: 1920), `VIEWPORT_HEIGHT` (default: 1080) - Screenshot dimensions

**Build:**
- `Dockerfile` - Multi-branch merge conflict (CUDA vs. slim); resolves to:
  - CUDA variant: `nvidia/cuda:12.4.1-runtime-ubuntu22.04` + PyTorch cu124 + TRIBE v2 git install + Playwright
  - Slim variant: `python:3.12-slim` + ffmpeg only
- `docker-compose.yml` - Service definition, env file loading, volume mounts for uploads/baselines/cache/huggingface cache

## Platform Requirements

**Development:**
- Python 3.12+ installed locally (or use Docker)
- ffmpeg installed on system (e.g., `winget install ffmpeg` on Windows)
- Optional: NVIDIA GPU with CUDA 12.4 compatible drivers for real TRIBE inference
- Node.js 18+ for Playwright (installed via pip as Playwright package includes Chromium)

**Production:**
- Docker image (nvidia/cuda:12.4.1 recommended for GPU, or python:3.12-slim for CPU)
- ffmpeg available in container (installed via apt-get)
- ANTHROPIC_API_KEY set for real LLM analysis
- Optional: RunPod API credentials for distributed GPU inference
- Port 9100 exposed

## Optional Dependencies

**When Real TRIBE v2 Inference Enabled:**
- PyTorch (via pip from cu124 wheels) - Loaded only if `TRIBE_MOCK_MODE=false`
- TRIBE v2 (git+https://github.com/facebookresearch/tribev2.git) - Facebook Research repo, GPU-required
- Note: Dockerfile contains unresolved merge conflict for this; comment indicates it's installed in CUDA branch

**When RunPod GPU Inference Used:**
- urllib (standard library) - HTTP requests to RunPod API
- base64, json (standard library) - Request serialization

---

*Stack analysis: 2026-04-05*
