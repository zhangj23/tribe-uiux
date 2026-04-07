"""TRIBE v2 inference wrapper with mock mode for development."""

import time
from pathlib import Path

import numpy as np

from app.config import settings


def run_inference(video_path: Path | None = None, audio_path: Path | None = None) -> tuple[np.ndarray, list[float]]:
    """
    Run TRIBE v2 inference on a media file.

    Returns:
        predictions: numpy array of shape (n_timesteps, 20484) — cortical vertex activations
        timestamps: list of float timestamps in seconds
    """
    if settings.tribe_mock_mode:
        return _mock_inference(video_path or audio_path)
    elif settings.runpod_endpoint_id and settings.runpod_api_key:
        return _runpod_inference(video_path, audio_path)
    else:
        return _real_inference(video_path, audio_path)


def _mock_inference(media_path: Path) -> tuple[np.ndarray, list[float]]:
    """
    Generate realistic mock TRIBE v2 output.

    Produces gaussian-distributed vertex activations with spatial
    structure (nearby vertices are correlated) and temporal dynamics
    (smooth changes over time).
    """
    # Simulate processing delay
    time.sleep(2)

    n_vertices = 20484
    n_timesteps = 30  # ~10 seconds at TR=0.33s

    # Base activation pattern — different regions have different baseline levels
    rng = np.random.default_rng(42)
    base_pattern = rng.normal(0.0, 0.3, size=n_vertices)

    # Create temporally smooth activations
    predictions = np.zeros((n_timesteps, n_vertices))
    for t in range(n_timesteps):
        # Smooth temporal evolution
        noise = rng.normal(0.0, 0.1, size=n_vertices)
        temporal_factor = 0.5 + 0.5 * np.sin(2 * np.pi * t / n_timesteps)
        predictions[t] = base_pattern * temporal_factor + noise

        # Add region-specific spikes to simulate interesting patterns
        # Visual cortex vertices (roughly indices 0-2000) — higher activation
        predictions[t, :2000] += 0.3 * temporal_factor
        # Prefrontal vertices (roughly 8000-10000) — cognitive load spike mid-way
        if 10 < t < 20:
            predictions[t, 8000:10000] += 0.4
        # Attention regions (roughly 5000-7000) — peaks at transitions
        if t in [5, 15, 25]:
            predictions[t, 5000:7000] += 0.5

    timestamps = [t * 0.33 for t in range(n_timesteps)]

    return predictions, timestamps


def _runpod_inference(video_path: Path | None, audio_path: Path | None) -> tuple[np.ndarray, list[float]]:
    """Run TRIBE v2 inference via RunPod Serverless endpoint."""
    import base64
    import json
    import urllib.request
    import urllib.error

    media_path = video_path or audio_path
    if media_path is None:
        raise ValueError("No media file provided")

    media_type = "audio" if audio_path else ("video" if video_path and video_path.suffix == ".mp4" else "image")

    with open(media_path, "rb") as f:
        media_b64 = base64.b64encode(f.read()).decode()

    endpoint_id = settings.runpod_endpoint_id
    api_key = settings.runpod_api_key

    # Submit job
    url = f"https://api.runpod.ai/v2/{endpoint_id}/runsync"
    payload = json.dumps({
        "input": {
            "media_base64": media_b64,
            "media_type": media_type,
            "filename": media_path.name,
        }
    }).encode()

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        raise RuntimeError(f"RunPod request failed ({e.code}): {body}")

    status = result.get("status")
    if status == "FAILED":
        raise RuntimeError(f"RunPod job failed: {result.get('error', 'unknown error')}")

    # For long jobs, runsync may return IN_QUEUE/IN_PROGRESS — poll until done
    if status in ("IN_QUEUE", "IN_PROGRESS"):
        job_id = result["id"]
        poll_url = f"https://api.runpod.ai/v2/{endpoint_id}/status/{job_id}"
        poll_req = urllib.request.Request(
            poll_url,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        for _ in range(120):  # poll for up to 10 minutes
            time.sleep(5)
            with urllib.request.urlopen(poll_req, timeout=30) as resp:
                result = json.loads(resp.read())
            if result.get("status") == "COMPLETED":
                break
            if result.get("status") == "FAILED":
                raise RuntimeError(f"RunPod job failed: {result.get('error', 'unknown error')}")
        else:
            raise RuntimeError("RunPod job timed out after 10 minutes")

    output = result.get("output", {})
    if "error" in output:
        raise RuntimeError(f"RunPod handler error: {output['error']}")

    predictions = np.array(output["predictions"], dtype=np.float32)
    timestamps = output["timestamps"]

    return predictions, timestamps


def _real_inference(video_path: Path | None, audio_path: Path | None) -> tuple[np.ndarray, list[float]]:
    """Run actual TRIBE v2 inference."""
    from app.dependencies import get_tribe_model

    model = get_tribe_model()
    if model is None:
        raise RuntimeError("TRIBE model not loaded")

    if video_path:
        df = model.get_events_dataframe(video_path=str(video_path))
    elif audio_path:
        df = model.get_events_dataframe(audio_path=str(audio_path))
    else:
        raise ValueError("No media file provided")

    preds, segments = model.predict(events=df)

    # preds shape: (n_segments, 20484) — only non-empty segments kept
    # If only 1 segment returned, tile it to create temporal dynamics
    if preds.shape[0] < 2:
        n_target = 30
        preds = np.tile(preds, (n_target, 1))
        # Add slight temporal variation
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

    return preds, timestamps
