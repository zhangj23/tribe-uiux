import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

# Job states
CREATED = "created"
CONVERTING = "converting"
PREDICTING = "predicting"
MAPPING = "mapping"
INTERPRETING = "interpreting"
COMPLETED = "completed"
FAILED = "failed"

executor = ThreadPoolExecutor(max_workers=2)


@dataclass
class Job:
    id: str
    status: str = CREATED
    media_type: str = ""  # "image", "video", "audio"
    input_path: Path | None = None
    video_path: Path | None = None
    progress: float = 0.0
    # Results
    raw_predictions: object = None  # numpy array from TRIBE
    metrics: dict | None = None
    z_scores: dict | None = None
    temporal_hotspots: list | None = None
    timeseries: dict | None = None
    timestamps: list | None = None
    brain_activations: list | None = None
    llm_analysis: str | None = None
    friction_score: float | None = None
    error: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    # Auth — who kicked off this job (None for anonymous callers).
    owner_id: str | None = None


# In-memory job store
_jobs: dict[str, Job] = {}


MAX_JOBS = 100
JOB_TTL_SECONDS = 1800  # 30 minutes


def _cleanup_old_jobs():
    """Remove completed/failed jobs older than TTL, or oldest if over MAX_JOBS."""
    now = datetime.now(timezone.utc)
    to_remove = []
    for jid, job in _jobs.items():
        age = (now - job.created_at).total_seconds()
        if age > JOB_TTL_SECONDS and job.status in (COMPLETED, FAILED):
            to_remove.append(jid)
    for jid in to_remove:
        del _jobs[jid]
    # Hard cap: remove oldest if still over limit
    if len(_jobs) > MAX_JOBS:
        sorted_jobs = sorted(_jobs.items(), key=lambda x: x[1].created_at)
        for jid, _ in sorted_jobs[: len(_jobs) - MAX_JOBS]:
            del _jobs[jid]


def create_job(
    media_type: str,
    input_path: Path,
    owner_id: str | None = None,
) -> Job:
    _cleanup_old_jobs()
    job_id = uuid.uuid4().hex[:12]
    job = Job(
        id=job_id,
        media_type=media_type,
        input_path=input_path,
        owner_id=owner_id,
    )
    _jobs[job_id] = job
    return job


def get_job(job_id: str) -> Job | None:
    return _jobs.get(job_id)


def update_job(job_id: str, **kwargs):
    job = _jobs.get(job_id)
    if job is None:
        return
    for key, value in kwargs.items():
        setattr(job, key, value)


def submit_pipeline(job: Job, pipeline_fn):
    """Submit a job to the background thread pool."""
    executor.submit(pipeline_fn, job)
