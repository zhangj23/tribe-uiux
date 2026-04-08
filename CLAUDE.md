# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

# TRIBE UX Analyzer

## What This Project Is

A web application that helps businesses improve their marketing and persuasion strategies using neuroscience-backed analysis. Users upload media (video, audio, images) and the app uses **Meta's TRIBE v2** brain encoding model to simulate how a human brain would react to it. The simulated neural activations are mapped to anatomical brain regions using the **Destrieux Atlas** (via nilearn on the fsaverage coordinate system), then an LLM translates the results into plain-English recommendations for improving the media's effectiveness.

**Goal:** Give advertisers and marketers a ranked list of brain regions their media activates, plus actionable next steps to improve engagement and reduce cognitive friction.

## Architecture

Two services running in separate containers behind `docker compose`:

- **Backend:** Python / FastAPI, port **9100** — API only, no static file serving
- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript, port **3000** — the URL you actually open in the browser
- **Brain Model:** Meta TRIBE v2 — outputs cortical vertex activations with shape `(n_timesteps, 20484)`
- **Atlas Mapping:** Destrieux Atlas via nilearn — maps TRIBE vertex coordinates to named brain regions using the shared fsaverage coordinate system
- **LLM:** Anthropic Claude API — interprets neural metrics and generates marketing recommendations
- **Optional GPU inference:** RunPod Serverless — `runpod/handler.py` runs TRIBE on a remote GPU when `RUNPOD_ENDPOINT_ID` and `RUNPOD_API_KEY` are set

The browser only ever talks to `localhost:3000`. The Next.js dev server proxies `/api/*` requests to the FastAPI backend over the Docker network (`http://app:9100`) via `rewrites()` in `next.config.ts`. The one exception is `POST /api/upload`, which has its own Route Handler at `frontend-next/src/app/api/upload/route.ts` because Next.js's rewrite proxy caps request bodies at 10 MB and we accept uploads up to 100 MB.

## Pipeline Flow

1. **Upload** — User uploads media via `POST /api/upload` → backend saves file, creates job (`upload.py`, `job_manager.py`). Alternative entry points: `POST /api/analyze/url` (screenshot a URL with Playwright) and `POST /api/analyze/compare` (run two designs side-by-side).
2. **Convert** — Media is prepared for TRIBE (image → scroll video, video/audio validated) (`media_converter.py`)
3. **Predict** — TRIBE v2 runs inference, producing vertex activations over time (`tribe_runner.py`)
4. **Map** — Vertex activations are mapped to Destrieux atlas regions and aggregated into UX metrics (`brain_mapper.py`, `brain_regions.py`)
5. **Normalize** — Metrics are z-scored against population baselines (`brain_mapper.py`)
6. **Interpret** — Claude API analyzes z-scores and hotspots, generates recommendations and a friction score (`llm_interpreter.py`)
7. **Display** — Frontend polls `GET /api/jobs/{job_id}` and shows heatmap, metrics, timeseries, and LLM analysis

Pipeline orchestration lives in `pipeline.py`. Job statuses flow: `CREATED → CONVERTING → PREDICTING → MAPPING → INTERPRETING → COMPLETED` (or `FAILED`).

## Project Structure

```
backend/
  app/
    config.py          — Settings (paths, TRIBE mode, API keys) via pydantic-settings + .env
    main.py            — FastAPI app setup, CORS, gzip, router registration
    dependencies.py    — Dependency injection (TRIBE model singleton)
    routers/
      upload.py        — POST /api/upload endpoint
      jobs.py          — GET /api/jobs/{job_id} endpoint (polling)
      health.py        — GET /api/health endpoint
      analyze_url.py   — POST /api/analyze/url (Playwright screenshot → pipeline)
      compare.py       — POST /api/analyze/compare (two designs A/B)
    services/
      pipeline.py      — Orchestrates the full analysis pipeline
      job_manager.py   — In-memory job store + background pipeline submission
      tribe_runner.py  — TRIBE v2 inference (mock, local, or RunPod)
      tribe_compat.py  — Windows compatibility patches for TRIBE v2
      brain_mapper.py  — Destrieux atlas mapping, z-score normalization
      media_converter.py — Image→video conversion, video/audio validation
      llm_interpreter.py — Claude API calls for analysis generation
    models/
      brain_regions.py — UX_REGION_GROUPS mapping (brain regions → UX metrics)
      schemas.py       — Pydantic request/response models
  requirements.txt
  run.py               — Entry point: uvicorn on port 9100

frontend-next/         — Next.js 15 + React 19 + TypeScript frontend
  next.config.ts       — Rewrites /api/* to BACKEND_URL (http://app:9100 in Docker)
  Dockerfile           — node:22-alpine, runs `npm run dev` on port 3000
  src/
    app/
      layout.tsx       — Root layout
      page.tsx         — Single-page app: upload → processing → results view switching
      api/
        upload/route.ts — Streaming proxy for /api/upload (bypasses 10 MB rewrite cap)
    components/
      Header.tsx
      UploadView.tsx       — Drag-and-drop upload, calls /api/upload
      ProcessingView.tsx   — Polling state, animated canvas
      ProcessingCanvas.tsx — Canvas animation during inference
      ResultsView.tsx      — Top-level results layout
      BrainCanvas.tsx      — Cortical heatmap rendering (canvas)
      MetricGauges.tsx     — UX metric gauges
      TimeseriesChart.tsx  — Activation-over-time chart
      FrictionScore.tsx    — Friction score widget
      AnalysisText.tsx     — LLM-generated narrative
    hooks/
      useHealth.ts    — Polls /api/health for the "MOCK MODE" badge
      usePolling.ts   — Polls /api/jobs/{id} during processing
    types/index.ts    — Shared TypeScript types (Job, etc.)
    styles/globals.css

data/
  baselines/           — Population baseline statistics (baselines.json)
  uploads/             — User-uploaded media files (gitignored, Docker volume)

runpod/                — RunPod Serverless GPU worker
  handler.py           — Entry point for remote TRIBE inference
  Dockerfile

scripts/
  generate_baselines.py    — Generate population baseline data
  export_brain_templates.py — Export brain visualization templates
  test_tribe_inference.py  — Local TRIBE smoke test
```

## Development

### Running with Docker (recommended)

```bash
docker compose up --build
```

Then open **http://localhost:3000** in your browser. The FastAPI backend is at `http://localhost:9100` but is API-only — hitting the root will 404.

To pass your Anthropic API key for real LLM analysis, create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Source files are volume-mounted:
- `./backend/app` → `/app/app` in the backend container (uvicorn `reload=True`)
- `./frontend-next/src` → `/app/src` in the frontend container (Next.js dev hot reload)

**Important:** `frontend-next/next.config.ts` is **not** volume-mounted — it's baked into the image at build time. If you change it, you must rebuild: `docker compose up -d --build frontend`.

To stop: `docker compose down`

### Running without Docker

```bash
# Backend
cd backend
pip install -r requirements.txt
python run.py        # serves on port 9100

# Frontend (separate terminal)
cd frontend-next
npm install
npm run dev          # serves on port 3000
```

Backend requires Python 3.12+ and ffmpeg. Frontend requires Node 22+.

### Key configuration (via .env or environment variables)

- `TRIBE_MOCK_MODE=true` — Default. Uses mock TRIBE inference (no GPU/model needed). Set `false` for real local inference.
- `ANTHROPIC_API_KEY` — Required for real LLM analysis. Without it, a mock analysis is generated.
- `TRIBE_DEVICE` — `cuda`, `cpu`, or `auto` for local TRIBE inference.
- `RUNPOD_ENDPOINT_ID` + `RUNPOD_API_KEY` — Set both to route TRIBE inference to a RunPod Serverless GPU worker instead of running locally.
- `BACKEND_URL` (frontend container only) — Where the Next.js server-side proxy reaches the backend. Defaults to `http://app:9100` in `docker-compose.yml`, or `http://localhost:9100` for local dev.

### Mock mode

By default the app runs in mock mode (`TRIBE_MOCK_MODE=true`), which generates synthetic neural data without requiring the TRIBE v2 model or GPU. This is the expected mode for frontend development, UI work, and testing the pipeline flow. The header shows a "MOCK MODE" badge when this is active.

## Key Concepts

- **fsaverage** — A standard brain coordinate system used by both TRIBE v2 and the Destrieux Atlas. TRIBE outputs vertex activations in fsaverage space; nilearn maps those coordinates to named anatomical regions.
- **Destrieux Atlas** — A cortical parcellation with 148 regions. We use it to translate raw vertex numbers into human-readable brain region names.
- **UX Metrics** — Brain regions are grouped into UX-relevant categories (e.g., cognitive load, attention/salience, emotional response). Defined in `brain_regions.py`.
- **Z-scores** — Each metric is compared against population baselines. z > 1 = elevated, z > 2 = extreme, z < -1 = unusually low.
- **Friction Score** — A 1-10 rating of overall UX friction, derived from the LLM analysis.

## Conventions

- Backend uses FastAPI with async endpoints; the pipeline runs in a background thread via `submit_pipeline` in `job_manager.py`
- Frontend is Next.js App Router + React 19 + TypeScript. Components are client components (`'use client'`) since the app is interactive single-page state, not SSR content.
- All API routes are prefixed with `/api`
- The frontend calls `/api/*` as relative paths; in Docker these are proxied through Next.js to the backend. Don't hardcode `localhost:9100` in frontend code.
- Large file uploads (`/api/upload`) go through the dedicated Route Handler at `src/app/api/upload/route.ts`, not the rewrite. If you add new endpoints that accept files larger than 10 MB, do the same.
- Configuration flows through `config.py` → pydantic-settings → `.env` file
- Brain region mappings and metric labels live in `models/brain_regions.py`
- When modifying the LLM prompt, keep it data-driven and focused on actionable marketing/persuasion recommendations
