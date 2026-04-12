"""Persistent mirror of completed analysis runs.

A `run` is the slim, durable record of a completed/failed `Job`:
- identity: job_id (ephemeral backend id) + id (row uuid)
- metadata: file, status, friction, metrics, z-scores, llm analysis
- organizational: project_id, label, note, pinned
- NOT stored: brain_activations / timeseries / timestamps (too large)
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.auth import CurrentUser, get_current_user, get_supabase_admin
from app.routers.projects import RunOut, _handle_supabase_error

router = APIRouter(tags=["runs"])


# -- Schemas ------------------------------------------------------------------


class RunCreate(BaseModel):
    job_id: str = Field(..., min_length=1, max_length=64)
    file_name: str = Field(..., min_length=1, max_length=500)
    file_type: str = Field(..., min_length=1, max_length=20)
    file_size: int = Field(..., ge=0)
    status: str = Field(..., min_length=1, max_length=40)
    friction_score: float | None = None
    metrics: dict[str, Any] | None = None
    z_scores: dict[str, Any] | None = None
    llm_analysis: str | None = None
    project_id: str | None = None
    label: str | None = None
    note: str | None = None
    pinned: bool = False
    duration_ms: int | None = Field(default=None, ge=0)


class RunPatch(BaseModel):
    label: str | None = None
    note: str | None = None
    pinned: bool | None = None
    project_id: str | None = None  # pass "" to detach from a project


# -- Helpers ------------------------------------------------------------------


def _verify_project_ownership(sb, project_id: str, user_id: str) -> None:
    res = (
        sb.table("projects")
        .select("id")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Project not found")


# -- Routes -------------------------------------------------------------------


@router.get("/runs", response_model=list[RunOut])
def list_runs(
    project_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    user: CurrentUser = Depends(get_current_user),
):
    sb = get_supabase_admin()
    q = sb.table("runs").select("*").eq("user_id", user.id)
    if project_id:
        q = q.eq("project_id", project_id)
    try:
        res = q.order("created_at", desc=True).limit(limit).execute()
    except Exception as exc:
        _handle_supabase_error(exc, "list runs")
    return [RunOut(**r) for r in (res.data or [])]


@router.post("/runs", response_model=RunOut, status_code=status.HTTP_201_CREATED)
def create_run(
    body: RunCreate,
    user: CurrentUser = Depends(get_current_user),
):
    sb = get_supabase_admin()

    if body.project_id:
        _verify_project_ownership(sb, body.project_id, user.id)

    payload: dict[str, Any] = {
        "user_id": user.id,
        "job_id": body.job_id,
        "file_name": body.file_name,
        "file_type": body.file_type,
        "file_size": body.file_size,
        "status": body.status,
        "friction_score": body.friction_score,
        "metrics": body.metrics,
        "z_scores": body.z_scores,
        "llm_analysis": body.llm_analysis,
        "project_id": body.project_id or None,
        "label": body.label,
        "note": body.note,
        "pinned": bool(body.pinned),
        "duration_ms": body.duration_ms,
    }

    # Upsert by (user_id, job_id) so repeated mirror calls are idempotent.
    try:
        existing = (
            sb.table("runs")
            .select("id")
            .eq("user_id", user.id)
            .eq("job_id", body.job_id)
            .limit(1)
            .execute()
        )
        if existing.data:
            run_id = existing.data[0]["id"]
            res = (
                sb.table("runs")
                .update(payload)
                .eq("id", run_id)
                .eq("user_id", user.id)
                .execute()
            )
        else:
            res = sb.table("runs").insert(payload).execute()
    except Exception as exc:
        _handle_supabase_error(exc, "create/upsert run")

    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to persist run")
    return RunOut(**rows[0])


@router.patch("/runs/{run_id}", response_model=RunOut)
def patch_run(
    run_id: str,
    body: RunPatch,
    user: CurrentUser = Depends(get_current_user),
):
    sb = get_supabase_admin()

    patch: dict[str, Any] = {}
    if body.label is not None:
        patch["label"] = body.label or None
    if body.note is not None:
        patch["note"] = body.note or None
    if body.pinned is not None:
        patch["pinned"] = bool(body.pinned)
    if body.project_id is not None:
        if body.project_id == "":
            patch["project_id"] = None
        else:
            _verify_project_ownership(sb, body.project_id, user.id)
            patch["project_id"] = body.project_id

    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        res = (
            sb.table("runs")
            .update(patch)
            .eq("id", run_id)
            .eq("user_id", user.id)
            .execute()
        )
    except Exception as exc:
        _handle_supabase_error(exc, "patch run")
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Run not found")
    return RunOut(**rows[0])


@router.delete("/runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_run(
    run_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    sb = get_supabase_admin()
    try:
        res = (
            sb.table("runs")
            .delete()
            .eq("id", run_id)
            .eq("user_id", user.id)
            .execute()
        )
    except Exception as exc:
        _handle_supabase_error(exc, "delete run")
    if not (res.data or []):
        raise HTTPException(status_code=404, detail="Run not found")
    return None
