"""Orchestrates the full analysis pipeline for a job."""

import os
import sys
import traceback

from app.config import settings

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

        # Step 4: Generate LLM analysis
        jm.update_job(job.id, status=jm.INTERPRETING, progress=0.8)
        duration = timestamps[-1] if timestamps else 0
        analysis, friction_score = generate_analysis(
            media_type=job.media_type,
            metrics=results["metrics"],
            z_scores=results["z_scores"],
            temporal_hotspots=results["temporal_hotspots"],
            duration=duration,
        )
        jm.update_job(
            job.id,
            llm_analysis=analysis,
            friction_score=friction_score,
            progress=1.0,
            status=jm.COMPLETED,
        )

    except Exception as e:
        jm.update_job(
            job.id,
            status=jm.FAILED,
            error=f"{type(e).__name__}: {e}\n{traceback.format_exc()}",
        )
