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
- **Auth + Data:** Supabase — Auth provides Google/GitHub/email+password sign-in; Postgres holds `projects` and `runs` tables with Row-Level Security. The Next.js app uses `@supabase/supabase-js` for the session; FastAPI validates the Supabase JWT (ES256 via JWKS, or HS256 via secret) using `python-jose` and uses `supabase-py` with the service-role key to read/write app data. When `AUTH_REQUIRED=true`, the app is gated behind the login view. See `docs/auth-setup.md` for the one-time Supabase project setup and `backend/migrations/001_auth_projects_runs.sql` for the schema.

The browser only ever talks to `localhost:3000`. The Next.js dev server proxies `/api/*` requests to the FastAPI backend over the Docker network (`http://app:9100`) via `rewrites()` in `next.config.ts`. The one exception is `POST /api/upload`, which has its own Route Handler at `frontend-next/src/app/api/upload/route.ts` because Next.js's rewrite proxy caps request bodies at 10 MB and we accept uploads up to 100 MB.

## Pipeline Flow

1. **Upload** — User uploads media via `POST /api/upload` → backend saves file, creates job (`upload.py`, `job_manager.py`). Alternative entry points: `POST /api/analyze/url` (screenshot a URL with Playwright) and `POST /api/analyze/compare` (run two designs side-by-side).
2. **Convert** — Media is prepared for TRIBE (image → scroll video, video/audio validated) (`media_converter.py`)
3. **Predict** — TRIBE v2 runs inference, producing vertex activations over time (`tribe_runner.py`)
4. **Map** — Vertex activations are mapped to Destrieux atlas regions and aggregated into UX metrics (`brain_mapper.py`, `brain_regions.py`)
5. **Normalize** — Metrics are z-scored against population baselines (`brain_mapper.py`)
6. **Interpret** — Claude API analyzes z-scores and hotspots, generates recommendations and a friction score (`llm_interpreter.py`)
7. **Display** — Frontend polls `GET /api/jobs/{job_id}` and shows heatmap, metrics, timeseries, and LLM analysis

Pipeline orchestration lives in `pipeline.py`. Job statuses flow: `CREATED → CONVERTING → PREDICTING → MAPPING → INTERPRETING → COMPLETED` (or `FAILED`). Jobs are kept in an in-memory dict in `job_manager.py` with a hard cap of 100 concurrent jobs and a 30-minute TTL for completed/failed jobs. Completed runs are mirrored to the Supabase `runs` table for persistence when a user is signed in.

## Project Structure

```
backend/
  app/
    config.py          — Settings (paths, TRIBE mode, API keys, Supabase) via pydantic-settings + .env
    main.py            — FastAPI app setup, CORS, gzip, router registration
    dependencies.py    — Dependency injection (TRIBE model singleton)
    routers/
      upload.py        — POST /api/upload endpoint
      jobs.py          — GET /api/jobs/{job_id} endpoint (polling)
      health.py        — GET /api/health endpoint
      analyze_url.py   — POST /api/analyze/url (Playwright screenshot → pipeline)
      compare.py       — POST /api/analyze/compare (two designs A/B)
      projects.py      — GET/POST/PATCH/DELETE /api/projects (user-owned groups of runs)
      runs.py          — GET/POST/PATCH/DELETE /api/runs (mirrored completed analyses)
    auth/
      jwt_verifier.py  — Verify Supabase-signed JWT (ES256 via JWKS, or HS256/384/512 via secret)
      dependencies.py  — CurrentUser, get_current_user, get_optional_user, get_supabase_admin
    services/
      pipeline.py      — Orchestrates the full analysis pipeline
      job_manager.py   — In-memory job store + background pipeline submission
      tribe_runner.py  — TRIBE v2 inference (mock, local, or RunPod)
      tribe_compat.py  — Windows compatibility patches for TRIBE v2
      brain_mapper.py  — Destrieux atlas mapping, z-score normalization
      media_converter.py — Image→video conversion, video/audio validation (ffmpeg)
      llm_interpreter.py — Claude API calls for analysis + friction score
    models/
      brain_regions.py — UX_REGION_GROUPS mapping (brain regions → UX metrics)
      schemas.py       — Pydantic request/response models
  migrations/
    001_auth_projects_runs.sql — Supabase SQL migration (projects + runs tables + RLS)
  requirements.txt
  run.py               — Entry point: uvicorn on port 9100

frontend-next/         — Next.js 15 + React 19 + TypeScript frontend
  next.config.ts       — Rewrites /api/* to BACKEND_URL (http://app:9100 in Docker)
  Dockerfile           — node:22-alpine, runs `npm run dev` on port 3000
  src/
    app/
      layout.tsx       — Root layout
      page.tsx         — Single-page app: login → upload → processing → results → project view switching
      api/
        upload/route.ts — Streaming proxy for /api/upload (bypasses 10 MB rewrite cap)
    components/
      Header.tsx           — Status indicator, friction badge, keyboard help, user menu
      UploadView.tsx       — Drag-and-drop upload, project chip, calls /api/upload
      ProcessingView.tsx   — Polling state, animated canvas
      ProcessingCanvas.tsx — Canvas animation during inference
      ResultsView.tsx      — Top-level results layout, project rank card
      CompareView.tsx      — Side-by-side delta view for two runs
      HistoryPanel.tsx     — Sidebar: search, filter chips, pin, note, export/import, compare
      BrainCanvas.tsx      — Cortical heatmap rendering (canvas)
      MetricGauges.tsx     — UX metric gauges
      TimeseriesChart.tsx  — Activation-over-time chart
      FrictionScore.tsx    — Friction score widget
      FrictionSparkline.tsx— Mini sparkline of recent runs' friction scores
      SpikeTimeline.tsx    — Temporal hotspot visualization
      AnalysisText.tsx     — LLM-generated narrative
      NextSteps.tsx        — Actionable recommendations from LLM
      ExportButton.tsx     — PDF / JSON export of a run
      KeyboardHelp.tsx     — Keyboard shortcuts modal (also surfaces recent runs)
      LoginView.tsx        — Google/GitHub/email+password sign-in/up
      ProjectSidebar.tsx   — Collapsible left sidebar: project list, create, rename, delete
      ProjectView.tsx      — Full project page with ranked runs table
      ProjectRankCard.tsx  — Rank card shown on results page within a project
    hooks/
      useHealth.ts    — Polls /api/health for the "MOCK MODE" badge
      usePolling.ts   — Polls /api/jobs/{id} during processing
      useAuth.ts      — Supabase session state, OAuth + email/password flows
      useHistory.ts   — localStorage history CRUD + server mirror when signed in
      useProjects.ts  — Projects CRUD + current project state
    lib/
      supabase.ts      — Supabase client singleton + SUPABASE_CONFIGURED / AUTH_REQUIRED flags
      api.ts           — apiFetch wrapper: auto-attaches auth headers, retries on 401
      history.ts       — localStorage history (max 12, pin-aware eviction, export/import, server merge)
      projects.ts      — Typed wrappers for /api/projects and /api/runs
      frictionTone.ts  — Shared friction score → color tone mapping
      compareDelta.ts  — Delta math between two runs
      demoJob.ts       — Sample data for first-time visitors
      exportFormatter.ts — PDF/JSON export helpers
      tabIdentity.ts   — Cross-tab identity for polling coordination
    types/index.ts    — Shared TypeScript types (Job, etc.)
    styles/globals.css — Design system (colors, typography, spacing tokens)

docs/
  auth-setup.md      — One-time Supabase project + OAuth provider setup guide

data/
  baselines/           — Population baseline statistics (baselines.json)
  uploads/             — User-uploaded media files (gitignored, Docker volume)

runpod/                — RunPod Serverless GPU worker
  handler.py           — Entry point for remote TRIBE inference
  Dockerfile

scripts/
  generate_baselines.py    — Generate population baseline data
  export_brain_templates.py — Export brain visualization templates
```

## Development

### Running with Docker (recommended)

```bash
docker compose up --build
```

Then open **http://localhost:3000** in your browser. The FastAPI backend is at `http://localhost:9100` but is API-only.

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
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Required for auth. Frontend-bundled; safe to expose.
- `SUPABASE_SERVICE_ROLE_KEY` — Backend only; bypasses RLS. **Never expose to the frontend.**
- `SUPABASE_JWT_SECRET` — Backend fallback for verifying HS256-signed JWTs (ES256 tokens use the JWKS endpoint automatically).
- `AUTH_REQUIRED` — `true` to gate the app behind the login screen (both frontend and `/api/upload`). `false` to keep anonymous usage working.

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
- Design system tokens (colors, typography, spacing) live in `frontend-next/src/styles/globals.css` — reuse `--phosphor`, `--cyan`, `--amber`, `--red`, `--font-display`, `--font-mono` instead of introducing new values
- History is cached client-side (`frontend-next/src/lib/history.ts`, localStorage key `tribe.history.v1`, max 12 entries with pin-aware eviction) and mirrored to the Supabase `runs` table when signed in
- Jobs are ephemeral (in-memory, 30 min TTL); completed runs are persisted to Supabase for signed-in users
- When modifying the LLM prompt, keep it data-driven and focused on actionable marketing/persuasion recommendations
