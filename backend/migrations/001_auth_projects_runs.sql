-- 001_auth_projects_runs.sql
-- Run this once in the Supabase SQL editor (Project → SQL editor → New query).
-- Creates the `projects` and `runs` tables, indexes, and row-level-security
-- policies so each user can only see and mutate their own rows.

-- ---------------------------------------------------------------------------
-- projects: owned by a user, groups a body of iterative work (e.g. "Q2 ad")
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
    id          uuid        primary key default gen_random_uuid(),
    user_id     uuid        not null references auth.users(id) on delete cascade,
    name        text        not null check (char_length(name) between 1 and 120),
    description text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create index if not exists projects_user_id_idx
    on public.projects(user_id);

-- ---------------------------------------------------------------------------
-- runs: mirror of a completed Job. One row per run the user has seen.
-- Heavy arrays (brain_activations, timeseries, timestamps) are intentionally
-- NOT mirrored -- they only live in the ephemeral in-memory Job.
-- ---------------------------------------------------------------------------

create table if not exists public.runs (
    id              uuid        primary key default gen_random_uuid(),
    project_id      uuid        references public.projects(id) on delete set null,
    user_id         uuid        not null references auth.users(id) on delete cascade,
    job_id          text        not null,
    file_name       text        not null,
    file_type       text        not null,      -- image|video|audio|other
    file_size       bigint      not null default 0,
    status          text        not null,      -- completed|failed
    friction_score  real,
    metrics         jsonb,
    z_scores        jsonb,
    llm_analysis    text,
    note            text,
    label           text,
    pinned          boolean     not null default false,
    duration_ms     integer,
    created_at      timestamptz not null default now()
);

create index if not exists runs_user_id_idx
    on public.runs(user_id);
create index if not exists runs_project_id_idx
    on public.runs(project_id);
create index if not exists runs_project_friction_idx
    on public.runs(project_id, friction_score)
    where friction_score is not null;

-- Idempotent mirror: one row per (user, job_id).
create unique index if not exists runs_user_job_uniq
    on public.runs(user_id, job_id);

-- ---------------------------------------------------------------------------
-- Row-level security: users only see / modify their own rows.
-- These policies are redundant with the backend's explicit `.eq("user_id", ...)`
-- filtering, but they're the safety net if a query ever forgets the filter.
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;
alter table public.runs     enable row level security;

-- projects ------------------------------------------------------------------

drop policy if exists "own_projects_select" on public.projects;
create policy "own_projects_select" on public.projects
    for select using (auth.uid() = user_id);

drop policy if exists "own_projects_insert" on public.projects;
create policy "own_projects_insert" on public.projects
    for insert with check (auth.uid() = user_id);

drop policy if exists "own_projects_update" on public.projects;
create policy "own_projects_update" on public.projects
    for update using (auth.uid() = user_id)
    with check  (auth.uid() = user_id);

drop policy if exists "own_projects_delete" on public.projects;
create policy "own_projects_delete" on public.projects
    for delete using (auth.uid() = user_id);

-- runs ----------------------------------------------------------------------

drop policy if exists "own_runs_select" on public.runs;
create policy "own_runs_select" on public.runs
    for select using (auth.uid() = user_id);

drop policy if exists "own_runs_insert" on public.runs;
create policy "own_runs_insert" on public.runs
    for insert with check (auth.uid() = user_id);

drop policy if exists "own_runs_update" on public.runs;
create policy "own_runs_update" on public.runs
    for update using (auth.uid() = user_id)
    with check  (auth.uid() = user_id);

drop policy if exists "own_runs_delete" on public.runs;
create policy "own_runs_delete" on public.runs
    for delete using (auth.uid() = user_id);
