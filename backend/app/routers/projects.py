"""CRUD for user-owned projects (groups of runs)."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import CurrentUser, get_current_user, get_supabase_admin

logger = logging.getLogger(__name__)


def _handle_supabase_error(exc: Exception, context: str = "Supabase operation") -> None:
    """Translate postgrest/supabase exceptions into HTTPException."""
    msg = str(exc)
    logger.error("%s failed: %s", context, msg)
    if "violates foreign key" in msg:
        raise HTTPException(status_code=400, detail="Invalid reference — the user or related record does not exist") from exc
    if "violates unique constraint" in msg or "duplicate key" in msg:
        raise HTTPException(status_code=409, detail="A record with that key already exists") from exc
    if "violates check constraint" in msg:
        raise HTTPException(status_code=400, detail="Validation failed — check field values") from exc
    raise HTTPException(status_code=502, detail=f"Database error: {msg[:200]}") from exc

router = APIRouter(tags=["projects"])


# -- Schemas ------------------------------------------------------------------


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)


class ProjectOut(BaseModel):
    id: str
    user_id: str
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    run_count: int | None = None
    best_friction_score: float | None = None


class RunOut(BaseModel):
    id: str
    project_id: str | None
    user_id: str
    job_id: str
    file_name: str
    file_type: str
    file_size: int
    status: str
    friction_score: float | None = None
    metrics: dict[str, Any] | None = None
    z_scores: dict[str, Any] | None = None
    llm_analysis: str | None = None
    note: str | None = None
    label: str | None = None
    pinned: bool = False
    duration_ms: int | None = None
    created_at: datetime


class ProjectDetail(ProjectOut):
    runs: list[RunOut] = []


# -- Helpers ------------------------------------------------------------------


def _row_to_project(row: dict) -> ProjectOut:
    return ProjectOut(
        id=row["id"],
        user_id=row["user_id"],
        name=row["name"],
        description=row.get("description"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        run_count=row.get("run_count"),
        best_friction_score=row.get("best_friction_score"),
    )


def _row_to_run(row: dict) -> RunOut:
    return RunOut(**row)


# -- Routes -------------------------------------------------------------------


@router.get("/projects", response_model=list[ProjectOut])
def list_projects(user: CurrentUser = Depends(get_current_user)):
    sb = get_supabase_admin()
    try:
        res = (
            sb.table("projects")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exc:
        _handle_supabase_error(exc, "list projects")
    projects = [_row_to_project(row) for row in (res.data or [])]

    # Aggregate run counts + best friction score per project.
    if projects:
        ids = [p.id for p in projects]
        try:
            runs_res = (
                sb.table("runs")
                .select("project_id,friction_score")
                .eq("user_id", user.id)
                .in_("project_id", ids)
                .execute()
            )
        except Exception:
            runs_res = type("R", (), {"data": []})()
        agg: dict[str, dict[str, Any]] = {pid: {"count": 0, "best": None} for pid in ids}
        for row in runs_res.data or []:
            pid = row.get("project_id")
            if not pid:
                continue
            bucket = agg.setdefault(pid, {"count": 0, "best": None})
            bucket["count"] += 1
            score = row.get("friction_score")
            if score is not None:
                current = bucket["best"]
                if current is None or score < current:
                    bucket["best"] = score
        for p in projects:
            bucket = agg.get(p.id, {"count": 0, "best": None})
            p.run_count = bucket["count"]
            p.best_friction_score = bucket["best"]

    return projects


@router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreate,
    user: CurrentUser = Depends(get_current_user),
):
    sb = get_supabase_admin()
    try:
        res = (
            sb.table("projects")
            .insert(
                {
                    "user_id": user.id,
                    "name": body.name.strip(),
                    "description": (body.description or None),
                }
            )
            .execute()
        )
    except Exception as exc:
        _handle_supabase_error(exc, "create project")
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=500, detail="Failed to create project")
    return _row_to_project(rows[0])


@router.get("/projects/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    sb = get_supabase_admin()
    try:
        p_res = (
            sb.table("projects")
            .select("*")
            .eq("id", project_id)
            .eq("user_id", user.id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        _handle_supabase_error(exc, "get project")
    if not p_res.data:
        raise HTTPException(status_code=404, detail="Project not found")
    project = _row_to_project(p_res.data[0])

    # Ranked runs: lowest friction score first, nulls at the end, then newest.
    try:
        runs_res = (
            sb.table("runs")
            .select("*")
            .eq("user_id", user.id)
            .eq("project_id", project_id)
            .order("friction_score", desc=False, nullsfirst=False)
            .order("created_at", desc=True)
            .execute()
        )
    except Exception as exc:
        _handle_supabase_error(exc, "list project runs")
    runs = [_row_to_run(r) for r in (runs_res.data or [])]
    project.run_count = len(runs)
    project.best_friction_score = next(
        (r.friction_score for r in runs if r.friction_score is not None),
        None,
    )
    return ProjectDetail(**project.model_dump(), runs=runs)


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: str,
    body: ProjectUpdate,
    user: CurrentUser = Depends(get_current_user),
):
    patch: dict[str, Any] = {}
    if body.name is not None:
        patch["name"] = body.name.strip()
    if body.description is not None:
        patch["description"] = body.description or None
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")
    patch["updated_at"] = datetime.utcnow().isoformat()

    sb = get_supabase_admin()
    try:
        res = (
            sb.table("projects")
            .update(patch)
            .eq("id", project_id)
            .eq("user_id", user.id)
            .execute()
        )
    except Exception as exc:
        _handle_supabase_error(exc, "update project")
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Project not found")
    return _row_to_project(rows[0])


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
):
    sb = get_supabase_admin()
    try:
        res = (
            sb.table("projects")
            .delete()
            .eq("id", project_id)
            .eq("user_id", user.id)
            .execute()
        )
    except Exception as exc:
        _handle_supabase_error(exc, "delete project")
    # Supabase returns deleted rows; if empty, 404.
    if not (res.data or []):
        raise HTTPException(status_code=404, detail="Project not found")
    return None
