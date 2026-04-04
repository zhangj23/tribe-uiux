from fastapi import APIRouter, HTTPException

from app.models.schemas import JobResponse
from app.services.job_manager import get_job

router = APIRouter(tags=["jobs"])


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job_status(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobResponse(
        job_id=job.id,
        status=job.status,
        progress=job.progress,
        media_type=job.media_type,
        metrics=job.metrics,
        z_scores=job.z_scores,
        temporal_hotspots=job.temporal_hotspots,
        timeseries=job.timeseries,
        timestamps=job.timestamps,
        brain_activations=job.brain_activations,
        llm_analysis=job.llm_analysis,
        friction_score=job.friction_score,
        error=job.error,
        created_at=job.created_at,
    )
