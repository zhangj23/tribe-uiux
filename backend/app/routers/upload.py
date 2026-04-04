import re
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException

from app.config import settings
from app.models.schemas import UploadResponse
from app.services.job_manager import create_job, submit_pipeline
from app.services.pipeline import run_pipeline


def _safe_filename(original: str) -> str:
    """Sanitize an uploaded filename to prevent path traversal."""
    name = Path(original).name  # strip directory components
    name = re.sub(r"[^a-zA-Z0-9._-]", "_", name)
    if not name or name.startswith("."):
        name = uuid.uuid4().hex[:12] + Path(original).suffix.lower()
    return name

router = APIRouter(tags=["upload"])

ALLOWED_IMAGE = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}
ALLOWED_VIDEO = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
ALLOWED_AUDIO = {".mp3", ".wav", ".ogg", ".flac", ".m4a"}


def _classify_media(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext in ALLOWED_IMAGE:
        return "image"
    if ext in ALLOWED_VIDEO:
        return "video"
    if ext in ALLOWED_AUDIO:
        return "audio"
    raise HTTPException(
        status_code=400,
        detail=f"Unsupported file type: {ext}. Supported: images, videos, audio.",
    )


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    media_type = _classify_media(file.filename)

    # Save uploaded file with sanitized name
    save_path = settings.upload_dir / _safe_filename(file.filename)
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Create job and start processing pipeline
    job = create_job(media_type=media_type, input_path=save_path)
    submit_pipeline(job, run_pipeline)

    return UploadResponse(job_id=job.id)
