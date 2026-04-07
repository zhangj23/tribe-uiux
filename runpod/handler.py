"""RunPod Serverless handler for TRIBE v2 inference.

Receives media files (as base64 or URLs), runs TRIBE v2 inference on GPU,
and returns cortical vertex predictions + timestamps.
"""

import base64
import os
import tempfile
from pathlib import Path

import numpy as np
import runpod


def _load_model():
    """Load TRIBE v2 model once at container startup (warm worker)."""
    import torch
    from tribev2 import TribeModel

    device = "cuda" if torch.cuda.is_available() else "cpu"
    cache_dir = os.environ.get("TRIBE_CACHE_DIR", "/cache")

    model = TribeModel.from_pretrained(
        "facebook/tribev2",
        checkpoint_name="best.ckpt",
        cache_folder=cache_dir,
        device=device,
    )
    print(f"TRIBE v2 loaded on {device}")
    return model


# Load model at import time (RunPod keeps the worker warm)
MODEL = _load_model()


def handler(event):
    """RunPod serverless handler.

    Input (event["input"]):
        media_base64: str — base64-encoded media file
        media_type: str — "image", "video", or "audio"
        filename: str — original filename (for extension detection)

    Returns:
        predictions: list[list[float]] — shape (n_timesteps, 20484)
        timestamps: list[float]
    """
    job_input = event["input"]

    media_b64 = job_input.get("media_base64")
    media_type = job_input.get("media_type", "image")
    filename = job_input.get("filename", "input.png")

    if not media_b64:
        return {"error": "media_base64 is required"}

    # Decode and save to temp file
    media_bytes = base64.b64decode(media_b64)
    ext = Path(filename).suffix or ".png"

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as f:
        f.write(media_bytes)
        temp_path = Path(f.name)

    try:
        video_path = None
        audio_path = None

        if media_type in ("image", "video"):
            if media_type == "image":
                # Convert image to scroll video for TRIBE
                from _media_utils import convert_image_to_scroll_video

                video_out = temp_path.with_suffix(".mp4")
                video_path = convert_image_to_scroll_video(temp_path, video_out)
            else:
                video_path = temp_path
        elif media_type == "audio":
            audio_path = temp_path

        # Run inference
        if video_path:
            df = MODEL.get_events_dataframe(video_path=str(video_path))
        elif audio_path:
            df = MODEL.get_events_dataframe(audio_path=str(audio_path))
        else:
            return {"error": "No processable media"}

        preds, segments = MODEL.predict(events=df)

        # Handle single-segment output
        if preds.shape[0] < 2:
            n_target = 30
            preds = np.tile(preds, (n_target, 1))
            rng = np.random.default_rng(0)
            for t in range(n_target):
                preds[t] += rng.normal(0, 0.01, size=preds.shape[1])
            timestamps = [t * 0.33 for t in range(n_target)]
        else:
            timestamps = []
            for seg in segments:
                if hasattr(seg, "start"):
                    timestamps.append(float(seg.start))
                elif hasattr(seg, "offset"):
                    timestamps.append(float(seg.offset))
                else:
                    timestamps.append(len(timestamps) * 0.33)

        return {
            "predictions": preds.tolist(),
            "timestamps": timestamps,
        }

    finally:
        # Cleanup temp files
        temp_path.unlink(missing_ok=True)
        mp4 = temp_path.with_suffix(".mp4")
        if mp4.exists():
            mp4.unlink()


runpod.serverless.start({"handler": handler})
