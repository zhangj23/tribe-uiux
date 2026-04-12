# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

# TRIBE UX Analyzer

## What This Project Is

A web application that helps businesses improve their marketing and persuasion strategies using neuroscience-backed analysis. Users upload media (video, audio, images, or text) and the app uses **Meta's TRIBE v2** brain encoding model to simulate how a human brain would react to it. The simulated neural activations are mapped to anatomical brain regions using the **Destrieux Atlas** (via nilearn on the fsaverage coordinate system), then an LLM translates the results into plain-English recommendations for improving the media's effectiveness.

**Goal:** Give advertisers and marketers a ranked list of brain regions their media activates, plus actionable next steps to improve engagement and reduce cognitive friction.

## Architecture

- **Backend:** Python / FastAPI (port 9100) — runs the pipeline, exposes `/api/*` routes, and mounts the legacy static frontend as a fallback.
- **Frontend (active):** Next.js 15 + React 19 + TypeScript at `frontend-next/` (port 3000). This is where all active feature work happens — history panel, compare view, notes, export/import, keyboard help, friction sparklines, etc. Talks to the backend via `/api/*` calls (proxied / CORS-allowed from port 3000 → 9100). Uses Chart.js for timeseries plots.
- **Frontend (legacy):** Vanilla HTML/CSS/JS at `frontend/`. Still present and still mounted by FastAPI at `/` on port 9100 as a fallback, but not the primary UI surface. New UX work should go in `frontend-next/`.
- **Brain Model:** Meta TRIBE v2 — outputs cortical vertex activations with shape `(n_timesteps, 20484)`. Can run locally (CPU/CUDA), on RunPod Serverless, or in mock mode.
- **Atlas Mapping:** Destrieux Atlas via nilearn — maps TRIBE vertex coordinates to named brain regions using the shared fsaverage coordinate system.
- **LLM:** Anthropic Claude API — interprets neural metrics and generates marketing recommendations.
- **Auth + Data:** Supabase — Auth provides Google/GitHub/email+password sign-in; Postgres holds `projects` and `runs` tables with Row-Level Security. The Next.js app uses `@supabase/supabase-js` for the session; FastAPI validates the Supabase JWT (HS256) via `python-jose` and uses `supabase-py` with the service-role key to read/write app data. When `AUTH_REQUIRED=true`, the app is gated behind the login view. See `docs/auth-setup.md` for the one-time Supabase project setup and `backend/migrations/001_auth_projects_runs.sql` for the schema.

## Pipeline Flow

1. **Upload** — User uploads media via `POST /api/upload` (or a URL via `POST /api/analyze/url`, or two files via `POST /api/analyze/compare`) → backend saves file, creates a job (`upload.py`, `analyze_url.py`, `compare.py`, `job_manager.py`).
2. **Convert** — Media is prepared for TRIBE (image → scroll video, video/audio validated) (`media_converter.py`).
3. **Predict** — TRIBE v2 runs inference, producing vertex activations over time (`tribe_runner.py`; Windows compatibility shims live in `tribe_compat.py`).
4. **Map** — Vertex activations are mapped to Destrieux atlas regions and aggregated into UX metrics (`brain_mapper.py`, `brain_regions.py`).
5. **Normalize** — Metrics are z-scored against population baselines (`brain_mapper.py`).
6. **Interpret** — Claude API analyzes z-scores and hotspots, generates recommendations and a friction score (`llm_interpreter.py`).
7. **Display** — Frontend polls `GET /api/jobs/{job_id}` every ~2s and renders the heatmap, metrics, friction score, and LLM analysis. In `frontend-next/` this is handled by `usePolling.ts` + `ResultsView.tsx` (+ `BrainCanvas`, `MetricGauges`, `AnalysisText`, `NextSteps`, `TimeseriesChart`, `SpikeTimeline`).

Pipeline orchestration lives in `pipeline.py`. Job statuses flow: `CREATED → CONVERTING → PREDICTING → MAPPING → INTERPRETING → COMPLETED` (or `FAILED`). Jobs are kept in an in-memory dict in `job_manager.py` with a hard cap of 100 concurrent jobs and a 30-minute TTL for completed/failed jobs — there is **no database** today.

## Project Structure

```
backend/
  app/
    config.py          — Settings (paths, TRIBE mode, API keys, RunPod) via pydantic-settings + .env
    main.py            — FastAPI app setup, CORS + GZip middleware, routes, static file serving
    dependencies.py    — Dependency injection (TRIBE model singleton)
    routers/
      upload.py        — POST /api/upload (multipart file)
      jobs.py          — GET /api/jobs/{job_id} (polling)
      health.py        — GET /api/health
      analyze_url.py   — POST /api/analyze/url (screenshot a URL, then analyze)
      compare.py       — POST /api/analyze/compare (two files, parallel jobs)
      projects.py      — GET/POST/PATCH/DELETE /api/projects (user-owned groups of runs)
      runs.py          — GET/POST/PATCH/DELETE /api/runs (mirrored completed analyses)
    auth/
      jwt_verifier.py  — Verify Supabase-signed JWT (HS256)
      dependencies.py  — CurrentUser, get_current_user, get_optional_user, get_supabase_admin
    services/
      pipeline.py      — Orchestrates the full analysis pipeline (background thread)
      job_manager.py   — In-memory job registry, status updates, TTL cleanup
      tribe_runner.py  — TRIBE v2 inference (mock, local CUDA/CPU, or RunPod serverless)
      tribe_compat.py  — Windows/Python compatibility shims for TRIBE
      brain_mapper.py  — Destrieux atlas mapping, z-score normalization
      media_converter.py — Image→video conversion, video/audio validation (ffmpeg)
      llm_interpreter.py — Claude API calls for analysis + friction score
    models/
      brain_regions.py — UX_REGION_GROUPS mapping (brain regions → UX metrics)
      schemas.py       — Pydantic request/response models
  requirements.txt
  run.py               — Entry point: uvicorn on port 9100

frontend-next/             ← ACTIVE FRONTEND (Next.js 15 + React 19 + TypeScript)
  next.config.ts
  Dockerfile               — Separate container, runs `next dev --port 3000`
  package.json             — next, react, react-dom, chart.js
  src/
    app/
      page.tsx             — Main view orchestrator (upload | processing | results | compare)
      layout.tsx           — Next.js root layout
    components/
      UploadView.tsx       — Drag-drop + URL input + history sidebar trigger
      ProcessingView.tsx   — Polling animation + progress bar
      ResultsView.tsx      — Orchestrates brain viz, metrics, friction, analysis, notes, compare seed
      CompareView.tsx      — Side-by-side delta view for two runs
      HistoryPanel.tsx     — Sidebar: search, filter chips, pin, note, export/import, compare
      Header.tsx           — Status indicator, friction badge, keyboard help
      BrainCanvas.tsx      — Cortical heatmap rendering
      MetricGauges.tsx     — Six UX metric gauges with z-score tones
      FrictionScore.tsx    — Friction score badge + tone mapping
      FrictionSparkline.tsx— Mini sparkline of recent runs' friction scores
      SpikeTimeline.tsx    — Temporal hotspot visualization
      TimeseriesChart.tsx  — Per-metric timeseries (Chart.js)
      AnalysisText.tsx     — LLM analysis renderer
      NextSteps.tsx        — Actionable recommendations from LLM
      ProcessingCanvas.tsx — Brain animation during polling
      ExportButton.tsx     — PDF / JSON export of a run
      KeyboardHelp.tsx     — Keyboard shortcuts modal (also surfaces recent runs)
    hooks/
      useHealth.ts         — Polls /api/health
      usePolling.ts        — Polls /api/jobs/{id} every 2s, handles retries
      useHistory.ts        — React wrapper over localStorage history CRUD
    lib/
      history.ts           — localStorage history (`tribe.history.v1`, max 12 entries, pin-aware eviction, export/import)
      compareDelta.ts      — Delta math between two runs
      demoJob.ts           — Sample data for first-time visitors
      exportFormatter.ts   — PDF/JSON export helpers
      tabIdentity.ts       — Cross-tab identity for polling coordination
    types/
      index.ts             — Job, HealthResponse, ZScores, UXMetrics types
    styles/
      globals.css          — Design system (colors, typography, spacing tokens)

frontend/                  ← LEGACY vanilla JS (still mounted by FastAPI at port 9100 as fallback)
  index.html
  css/                 — main.css, components.css
  js/
    app.js             — Main controller, view switching
    upload.js          — File upload handling
    polling.js         — Job status polling
    brain-view.js      — Cortical heatmap rendering (canvas)
    results.js         — Metrics gauges, timeseries chart, LLM analysis display
    compare.js         — Compare view
    charts.js          — Chart utilities

data/
  baselines/           — Population baseline statistics (baselines.json)
  uploads/             — User-uploaded media files (gitignored)

scripts/
  generate_baselines.py    — Generate population baseline data
  export_brain_templates.py — Export brain visualization templates

runpod/                — RunPod Serverless handler for remote TRIBE inference
docs/                  — Additional docs
```

## Development

### Running with Docker (recommended)

```bash
docker compose up --build
# Backend API:     http://localhost:9100
# Next.js frontend: http://localhost:3000   ← use this one
```

`docker-compose.yml` defines two services:
- **app** — FastAPI backend on port 9100. Volume-mounts `backend/app/` so edits hot-reload via uvicorn.
- **frontend** — Next.js dev server on port 3000, built from `frontend-next/Dockerfile`. Volume-mounts `frontend-next/src/` for HMR. Depends on `app`.

To pass your Anthropic API key for real LLM analysis, create a `.env` file in the project root:

```
ANTHROPIC_API_KEY=sk-ant-...
```

To stop: `docker compose down`

### Running without Docker

Backend:
```bash
cd backend
pip install -r requirements.txt
python run.py
# API at http://localhost:9100
```

Frontend (separate terminal):
```bash
cd frontend-next
npm install
npm run dev
# UI at http://localhost:3000
```

Requires Python 3.12+, Node.js 20+, and ffmpeg installed on your system.

### Key configuration (via .env or environment variables)

- `TRIBE_MOCK_MODE=true` — Default. Uses mock TRIBE inference (no GPU/model needed). Set `false` for real inference.
- `ANTHROPIC_API_KEY` — Required for real LLM analysis. Without it, a mock analysis is generated.
- `TRIBE_DEVICE` — `cuda`, `cpu`, or `auto` (default) for local TRIBE inference.
- `RUNPOD_ENDPOINT_ID` / `RUNPOD_API_KEY` — Set both to route TRIBE inference to RunPod Serverless instead of running locally.
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Required for auth. Frontend-bundled; safe to expose.
- `SUPABASE_SERVICE_ROLE_KEY` — Backend only; bypasses RLS. **Never expose to the frontend.**
- `SUPABASE_JWT_SECRET` — Backend uses it to verify Supabase-signed JWTs.
- `AUTH_REQUIRED` — `true` to gate the app behind the login screen (both frontend and `/api/upload`). `false` to keep anonymous usage working.

### Mock mode

By default the app runs in mock mode (`TRIBE_MOCK_MODE=true`), which generates synthetic neural data without requiring the TRIBE v2 model or GPU. This is the expected mode for frontend development, UI work, and testing the pipeline flow.

## Key Concepts

- **fsaverage** — A standard brain coordinate system used by both TRIBE v2 and the Destrieux Atlas. TRIBE outputs vertex activations in fsaverage space; nilearn maps those coordinates to named anatomical regions.
- **Destrieux Atlas** — A cortical parcellation with 148 regions. We use it to translate raw vertex numbers into human-readable brain region names.
- **UX Metrics** — Brain regions are grouped into UX-relevant categories (e.g., cognitive load, attention/salience, emotional response). Defined in `brain_regions.py`.
- **Z-scores** — Each metric is compared against population baselines. z > 1 = elevated, z > 2 = extreme, z < -1 = unusually low.
- **Friction Score** — A 1-10 rating of overall UX friction, derived from the LLM analysis.

## Conventions

- Backend uses FastAPI with async endpoints; pipeline runs in a background thread (`ThreadPoolExecutor`, max 2 workers) in `job_manager.py`
- Active frontend is `frontend-next/` — Next.js 15 + React 19 + TypeScript. Put new UI work there, not in the legacy `frontend/`
- All API routes are prefixed with `/api`
- Configuration flows through `config.py` → pydantic-settings → `.env` file
- Brain region mappings and metric labels live in `models/brain_regions.py`
- Design system tokens (colors, typography, spacing) live in `frontend-next/src/styles/globals.css` — reuse `--phosphor`, `--cyan`, `--amber`, `--red`, `--font-display`, `--font-mono` instead of introducing new values
- History is client-side only today (`frontend-next/src/lib/history.ts`, localStorage key `tribe.history.v1`, max 12 entries with pin-aware eviction)
- Jobs are ephemeral (in-memory, 30 min TTL) — there is no database yet
- When modifying the LLM prompt, keep it data-driven and focused on actionable marketing/persuasion recommendations
