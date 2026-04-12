'use client';

import { apiFetch, apiJson } from './api';
import type { Job } from '@/types';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  run_count?: number | null;
  best_friction_score?: number | null;
}

export interface Run {
  id: string;
  project_id: string | null;
  user_id: string;
  job_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: string;
  friction_score: number | null;
  metrics: Record<string, number> | null;
  z_scores: Record<string, number> | null;
  llm_analysis: string | null;
  note: string | null;
  label: string | null;
  pinned: boolean;
  duration_ms: number | null;
  created_at: string;
}

export interface ProjectDetail extends Project {
  runs: Run[];
}

export interface ProjectCreateInput {
  name: string;
  description?: string;
}

export interface ProjectUpdateInput {
  name?: string;
  description?: string;
}

// -- Projects -----------------------------------------------------------------

export function listProjects(): Promise<Project[]> {
  return apiJson<Project[]>('/api/projects');
}

export function getProject(id: string): Promise<ProjectDetail> {
  return apiJson<ProjectDetail>(`/api/projects/${encodeURIComponent(id)}`);
}

export function createProject(input: ProjectCreateInput): Promise<Project> {
  return apiJson<Project>('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateProject(id: string, patch: ProjectUpdateInput): Promise<Project> {
  return apiJson<Project>(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteProject(id: string): Promise<void> {
  const resp = await apiFetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!resp.ok && resp.status !== 204) {
    throw new Error(`Failed to delete project: ${resp.status}`);
  }
}

// -- Runs ---------------------------------------------------------------------

export interface RunCreateInput {
  job_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: string;
  friction_score?: number | null;
  metrics?: Record<string, number> | null;
  z_scores?: Record<string, number> | null;
  llm_analysis?: string | null;
  project_id?: string | null;
  label?: string | null;
  note?: string | null;
  pinned?: boolean;
  duration_ms?: number | null;
}

export interface RunPatchInput {
  label?: string | null;
  note?: string | null;
  pinned?: boolean;
  /** Empty string detaches from a project; undefined leaves it unchanged. */
  project_id?: string | null;
}

export function listRuns(projectId?: string): Promise<Run[]> {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return apiJson<Run[]>(`/api/runs${qs}`);
}

export function createRun(input: RunCreateInput): Promise<Run> {
  return apiJson<Run>('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function patchRun(id: string, patch: RunPatchInput): Promise<Run> {
  return apiJson<Run>(`/api/runs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteRun(id: string): Promise<void> {
  const resp = await apiFetch(`/api/runs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!resp.ok && resp.status !== 204) {
    throw new Error(`Failed to delete run: ${resp.status}`);
  }
}

// -- Helpers ------------------------------------------------------------------

/** Build the run payload from a completed Job + upload metadata. Keeps the
 * slim fields only (no `brain_activations`, no heavy timeseries). */
export function jobToRunPayload(
  job: Job,
  meta: { fileName: string; fileSize: number; fileType: string; durationMs?: number },
  projectId: string | null,
): RunCreateInput {
  return {
    job_id: job.job_id,
    file_name: meta.fileName,
    file_type: meta.fileType,
    file_size: meta.fileSize,
    status: job.status,
    friction_score: job.friction_score ?? null,
    metrics: null,
    z_scores: (job.z_scores as unknown as Record<string, number>) ?? null,
    llm_analysis: job.llm_analysis ?? null,
    project_id: projectId,
    duration_ms: meta.durationMs ?? null,
  };
}
