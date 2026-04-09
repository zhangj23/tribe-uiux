"""Orchestrates the full analysis pipeline for a job."""

import logging
import os
import sys
import traceback

from app.config import settings

logger = logging.getLogger(__name__)


def _user_facing_error(exc: Exception) -> str:
    """Translate an internal exception into a short, safe, user-facing message."""
    kind = type(exc).__name__
    msg = str(exc).strip()

    # Known exception types get friendlier phrasing
    friendly = {
        "FileNotFoundError": "We couldn't find the uploaded file on disk. Please try uploading it again.",
        "PermissionError": "The server couldn't read the uploaded file. Please try again.",
        "ValueError": "The uploaded file couldn't be decoded. Please check the format and try again.",
        "TimeoutError": "The analysis took too long to complete. Please try a shorter clip or smaller file.",
        "MemoryError": "The file was too large for the server to process. Try a smaller or shorter clip.",
    }
    if kind in friendly:
        return friendly[kind]

    # ffmpeg / media conversion failures usually surface as CalledProcessError
    if "CalledProcessError" in kind or "ffmpeg" in msg.lower():
        return "We couldn't decode that media file. It may be corrupt or in an unsupported codec."

    if "Anthropic" in kind or "anthropic" in msg.lower():
        return "The AI analysis service is temporarily unavailable. Please try again in a moment."

    # Fall back to a clean generic message — never leak the traceback to the client.
    return "Something went wrong while analyzing your media. Please try again, or use a different file."

# Ensure ffmpeg is findable on Windows
if sys.platform == "win32":
    _ffmpeg_dir = os.path.expandvars(r"%LOCALAPPDATA%\ffmpeg-bin")
    if os.path.isdir(_ffmpeg_dir) and _ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = os.environ.get("PATH", "") + os.pathsep + _ffmpeg_dir
from app.services import job_manager as jm
from app.services.tribe_runner import run_inference
from app.services.brain_mapper import compute_ux_metrics
from app.services.llm_interpreter import generate_analysis


def run_pipeline(job: jm.Job):
    """
    Run the full analysis pipeline in a background thread.

    Steps: CONVERTING -> PREDICTING -> MAPPING -> INTERPRETING -> COMPLETED
    """
    try:
        # Step 1: Convert media (skip in mock mode — no ffmpeg needed)
        jm.update_job(job.id, status=jm.CONVERTING, progress=0.1)
        video_path = None
        audio_path = None

        if not settings.tribe_mock_mode:
            from app.services.media_converter import (
                convert_image_to_scroll_video,
                validate_video,
                validate_audio,
            )
            if job.media_type == "image":
                output_video = job.input_path.with_suffix(".mp4")
                video_path = convert_image_to_scroll_video(job.input_path, output_video)
                jm.update_job(job.id, video_path=video_path)
            elif job.media_type == "video":
                video_path = validate_video(job.input_path)
                jm.update_job(job.id, video_path=video_path)
            elif job.media_type == "audio":
                audio_path = validate_audio(job.input_path)

        jm.update_job(job.id, progress=0.25)

        # Step 2: Run TRIBE inference
        jm.update_job(job.id, status=jm.PREDICTING, progress=0.3)
        predictions, timestamps = run_inference(
            video_path=video_path,
            audio_path=audio_path,
        )
        jm.update_job(job.id, raw_predictions=predictions, progress=0.55)

        # Step 3: Map to UX metrics
        jm.update_job(job.id, status=jm.MAPPING, progress=0.6)
        results = compute_ux_metrics(predictions, timestamps)
        jm.update_job(
            job.id,
            metrics=results["metrics"],
            z_scores=results["z_scores"],
            temporal_hotspots=results["temporal_hotspots"],
            timeseries=results["timeseries"],
            timestamps=results["timestamps"],
            brain_activations=results["brain_activations"],
            progress=0.75,
        )

        # Step 4: Generate LLM analysis (with image for multimodal)
        jm.update_job(job.id, status=jm.INTERPRETING, progress=0.8)
        duration = timestamps[-1] if timestamps else 0
        # Pass original image for multimodal analysis when available
        image_path = None
        if job.media_type == "image" and job.input_path and job.input_path.exists():
            image_path = str(job.input_path)
        analysis, friction_score = generate_analysis(
            media_type=job.media_type,
            metrics=results["metrics"],
            z_scores=results["z_scores"],
            temporal_hotspots=results["temporal_hotspots"],
            duration=duration,
            image_path=image_path,
        )
        jm.update_job(
            job.id,
            llm_analysis=analysis,
            friction_score=friction_score,
            progress=1.0,
            status=jm.COMPLETED,
        )

    except Exception as e:
        # Log the full traceback server-side for debugging…
        logger.error(
            "Pipeline failed for job %s: %s\n%s",
            job.id,
            e,
            traceback.format_exc(),
        )
        # …but only return a clean, user-facing message to the client.
        jm.update_job(
            job.id,
            status=jm.FAILED,
            error=_user_facing_error(e),
        )
