"""Minimal media conversion utilities for the RunPod handler."""

import subprocess
from pathlib import Path


def convert_image_to_scroll_video(
    image_path: Path,
    output_path: Path,
    duration: int = 10,
    scroll_speed: int = 200,
    width: int = 1920,
    height: int = 1080,
) -> Path:
    """Convert a static image to a scrolling video for TRIBE v2 input.

    Uses ffmpeg to create a video that pans vertically over the image,
    simulating a user scrolling through a webpage.
    """
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1",
        "-i", str(image_path),
        "-filter_complex",
        (
            f"scale={width}:-1,"
            f"pad={width}:ih+{height}:0:{height // 2}:black,"
            f"crop={width}:{height}:0:'min(t*{scroll_speed},ih-{height})'"
        ),
        "-t", str(duration),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-r", "30",
        str(output_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path
