"""POST /api/analyze/compare — run two designs through the pipeline and compare."""

import shutil
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from pydantic import BaseModel

from app.config import settings
from app.services.job_manager import create_job, get_job, submit_pipeline
from app.services.pipeline import run_pipeline

router = APIRouter(tags=["compare"])


class CompareResponse(BaseModel):
    job_id_a: str
    job_id_b: str


@router.post("/analyze/compare", response_model=CompareResponse)
async def compare_designs(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
):
    """Upload two files and run both through the analysis pipeline."""
    jobs = []
    for label, file in [("a", file_a), ("b", file_b)]:
        ext = Path(file.filename).suffix.lower()
        allowed = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif",
                   ".mp4", ".mov", ".avi", ".mkv", ".webm",
                   ".mp3", ".wav", ".ogg", ".flac", ".m4a"}
        if ext not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"File {label.upper()}: unsupported type {ext}",
            )

        # Determine media type
        img_ext = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"}
        vid_ext = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
        if ext in img_ext:
            media_type = "image"
        elif ext in vid_ext:
            media_type = "video"
        else:
            media_type = "audio"

        save_path = settings.upload_dir / f"compare_{label}_{file.filename}"
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        job = create_job(media_type=media_type, input_path=save_path)
        submit_pipeline(job, run_pipeline)
        jobs.append(job)

    return CompareResponse(job_id_a=jobs[0].id, job_id_b=jobs[1].id)
