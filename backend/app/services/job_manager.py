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


# In-memory job store
_jobs: dict[str, Job] = {}


def create_job(media_type: str, input_path: Path) -> Job:
    job_id = uuid.uuid4().hex[:12]
    job = Job(id=job_id, media_type=media_type, input_path=input_path)
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
