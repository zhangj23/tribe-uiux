from datetime import datetime
from pydantic import BaseModel


class UploadResponse(BaseModel):
    job_id: str


class UXMetrics(BaseModel):
    visual_processing: float
    object_recognition: float
    reading_language: float
    attention_salience: float
    cognitive_load: float
    emotional_response: float


class TemporalHotspot(BaseModel):
    timestamp: float
    metric: str
    value: float
    section: str  # "top", "middle", "bottom"


class JobResponse(BaseModel):
    job_id: str
    status: str
    progress: float
    media_type: str | None = None
    metrics: UXMetrics | None = None
    z_scores: UXMetrics | None = None
    temporal_hotspots: list[TemporalHotspot] | None = None
    timeseries: dict[str, list[float]] | None = None
    timestamps: list[float] | None = None
    brain_activations: list[list[float]] | None = None
    llm_analysis: str | None = None
    friction_score: float | None = None
    error: str | None = None
    created_at: datetime | None = None


class HealthResponse(BaseModel):
    status: str
    tribe_mock_mode: bool
    model_loaded: bool
