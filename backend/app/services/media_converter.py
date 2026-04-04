"""Convert static images to scrolling videos for TRIBE v2 input."""

import subprocess
import shutil
from pathlib import Path

from app.config import settings


def _check_ffmpeg():
    if shutil.which("ffmpeg") is None:
        raise RuntimeError(
            "ffmpeg not found on PATH. Install it: winget install ffmpeg"
        )


def convert_image_to_scroll_video(
    image_path: Path,
    output_path: Path,
) -> Path:
    """
    Convert a tall screenshot into a scrolling video that simulates
    a user scrolling down the page.

    Uses ffmpeg crop filter with a time-varying y offset.
    Includes 2-second holds at top and bottom.
    """
    _check_ffmpeg()

    vw = settings.viewport_width
    vh = settings.viewport_height
    speed = settings.scroll_speed_px_per_sec

    # Probe image dimensions
    probe = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-select_streams", "v:0",
            "-show_entries", "stream=width,height",
            "-of", "csv=p=0",
            str(image_path),
        ],
        capture_output=True, text=True, check=True,
    )
    img_w, img_h = map(int, probe.stdout.strip().split(","))

    # If image fits in one viewport, use Ken Burns effect instead
    if img_h <= vh * 1.2:
        return _convert_static_image(image_path, output_path, img_w, img_h)

    # Calculate scroll duration
    scroll_distance = img_h - vh
    scroll_duration = scroll_distance / speed
    hold_time = 2.0
    total_duration = hold_time + scroll_duration + hold_time

    # Build ffmpeg filter:
    # - Scale image to viewport width if needed
    # - Crop a viewport-sized window that scrolls down over time
    # - Hold at top for 2s, scroll, hold at bottom for 2s
    y_expr = (
        f"if(lt(t,{hold_time}),0,"
        f"if(lt(t,{hold_time + scroll_duration}),"
        f"(t-{hold_time})*{speed},"
        f"{scroll_distance}))"
    )

    filter_complex = (
        f"scale={vw}:-1,"
        f"crop={vw}:{vh}:0:'{y_expr}'"
    )

    subprocess.run(
        [
            "ffmpeg", "-y",
            "-loop", "1", "-i", str(image_path),
            "-t", str(total_duration),
            "-vf", filter_complex,
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-r", "30",
            str(output_path),
        ],
        capture_output=True, text=True, check=True,
    )

    return output_path


def _convert_static_image(
    image_path: Path,
    output_path: Path,
    img_w: int,
    img_h: int,
) -> Path:
    """
    For images that fit in one viewport: 3-second static hold
    followed by a 5-second slow Ken Burns zoom.
    """
    total_duration = 8.0

    # Slow zoom from 100% to 110% over the video duration
    zoom_expr = "1+0.1*t/8"
    filter_complex = (
        f"scale=1920:1080:force_original_aspect_ratio=decrease,"
        f"pad=1920:1080:(ow-iw)/2:(oh-ih)/2,"
        f"zoompan=z='{zoom_expr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
        f":d={int(total_duration * 30)}:s=1920x1080:fps=30"
    )

    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(image_path),
            "-vf", filter_complex,
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-t", str(total_duration),
            str(output_path),
        ],
        capture_output=True, text=True, check=True,
    )

    return output_path


def validate_video(video_path: Path) -> Path:
    """Verify a video file is valid and return the path."""
    _check_ffmpeg()
    result = subprocess.run(
        ["ffprobe", "-v", "error", str(video_path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise ValueError(f"Invalid video file: {result.stderr}")
    return video_path


def validate_audio(audio_path: Path) -> Path:
    """Verify an audio file is valid and return the path."""
    _check_ffmpeg()
    result = subprocess.run(
        ["ffprobe", "-v", "error", str(audio_path)],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        raise ValueError(f"Invalid audio file: {result.stderr}")
    return audio_path
