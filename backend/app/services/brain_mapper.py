"""Map TRIBE v2 cortical vertex predictions to UX-relevant metrics."""

import json
from pathlib import Path

import numpy as np

from app.config import settings
from app.models.brain_regions import UX_REGION_GROUPS, Z_SCORE_INTERPRETATION


# Hardcoded baseline stats (reasonable defaults for mock mode).
# Replace with real baselines from scripts/generate_baselines.py
DEFAULT_BASELINES = {
    "visual_processing": {"mean": 0.35, "std": 0.12},
    "object_recognition": {"mean": 0.25, "std": 0.10},
    "reading_language": {"mean": 0.20, "std": 0.08},
    "attention_salience": {"mean": 0.30, "std": 0.11},
    "cognitive_load": {"mean": 0.28, "std": 0.09},
    "emotional_response": {"mean": 0.18, "std": 0.07},
}

# Vertex-to-region label mapping (loaded lazily)
_vertex_labels_lh = None
_vertex_labels_rh = None
_label_names = None


def _load_atlas():
    """Load the Destrieux atlas labels. Falls back to mock mapping."""
    global _vertex_labels_lh, _vertex_labels_rh, _label_names

    if _vertex_labels_lh is not None:
        return

    try:
        from nilearn.datasets import fetch_atlas_surf_destrieux
        atlas = fetch_atlas_surf_destrieux()
        _vertex_labels_lh = np.array(atlas["map_left"])
        _vertex_labels_rh = np.array(atlas["map_right"])
        _label_names = [l.decode() if isinstance(l, bytes) else str(l) for l in atlas["labels"]]
    except Exception:
        # Fallback: create mock region assignments for development
        _vertex_labels_lh = np.zeros(10242, dtype=int)
        _vertex_labels_rh = np.zeros(10242, dtype=int)
        _label_names = ["Unknown"]
        _create_mock_region_assignments()


def _create_mock_region_assignments():
    """Assign mock region labels to vertices for development without nilearn."""
    global _vertex_labels_lh, _vertex_labels_rh, _label_names

    _label_names = [
        "Unknown",
        "S_calcarine", "G_cuneus", "Pole_occipital",
        "G_oc-temp_lat-fusifor", "G_temporal_inf",
        "G_temp_sup-Lateral", "G_pariet_inf-Angular", "G_front_inf-Opercular",
        "S_intrapariet_and_P_trans", "G_and_S_cingul-Mid-Ant", "G_front_sup",
        "G_front_middle", "G_and_S_cingul-Ant",
        "G_orbital", "Pole_temporal", "G_Ins_lg_and_S_cent_ins",
    ]

    n_lh = 10242
    # Distribute vertices across regions (rough approximation)
    assignments = np.zeros(n_lh, dtype=int)
    chunk = n_lh // len(_label_names)
    for i in range(len(_label_names)):
        start = i * chunk
        end = min((i + 1) * chunk, n_lh)
        assignments[start:end] = i

    _vertex_labels_lh[:] = assignments
    _vertex_labels_rh[:] = assignments


def _get_region_vertex_masks() -> dict[str, np.ndarray]:
    """
    Build boolean masks for each UX metric group.
    Returns masks over the full 20,484 vertices (LH + RH concatenated).
    """
    _load_atlas()

    all_labels = np.concatenate([_vertex_labels_lh, _vertex_labels_rh])
    masks = {}

    for metric_name, region_substrings in UX_REGION_GROUPS.items():
        mask = np.zeros(20484, dtype=bool)
        for idx, label in enumerate(_label_names):
            for substr in region_substrings:
                if substr in label:
                    mask |= (all_labels == idx)
                    break
        masks[metric_name] = mask

    return masks


def compute_ux_metrics(
    predictions: np.ndarray,
    timestamps: list[float],
) -> dict:
    """
    Convert raw cortical vertex predictions into UX metrics.

    Args:
        predictions: shape (n_timesteps, 20484)
        timestamps: list of timestamps in seconds

    Returns:
        dict with keys: metrics, z_scores, temporal_hotspots, timeseries, brain_activations
    """
    masks = _get_region_vertex_masks()
    baselines = _load_baselines()

    n_timesteps = predictions.shape[0]
    timeseries = {}
    metrics = {}
    z_scores = {}

    # Compute per-metric timeseries
    for metric_name, mask in masks.items():
        if mask.sum() == 0:
            ts = np.zeros(n_timesteps)
        else:
            ts = predictions[:, mask].mean(axis=1)
        timeseries[metric_name] = ts.tolist()

        # Summary: mean activation across time
        mean_val = float(ts.mean())
        metrics[metric_name] = round(mean_val, 4)

        # Z-score against baseline
        bl = baselines[metric_name]
        z = (mean_val - bl["mean"]) / bl["std"] if bl["std"] > 0 else 0.0
        z_scores[metric_name] = round(z, 2)

    # Find temporal hotspots (peak moments for each metric)
    total_duration = timestamps[-1] if timestamps else 0
    temporal_hotspots = []
    for metric_name, ts_values in timeseries.items():
        arr = np.array(ts_values)
        peak_idx = int(arr.argmax())
        peak_time = timestamps[peak_idx] if peak_idx < len(timestamps) else 0

        # Determine which section of the page/video this corresponds to
        if total_duration > 0:
            position = peak_time / total_duration
        else:
            position = 0
        if position < 0.33:
            section = "top"
        elif position < 0.66:
            section = "middle"
        else:
            section = "bottom"

        temporal_hotspots.append({
            "timestamp": round(peak_time, 2),
            "metric": metric_name,
            "value": round(float(arr[peak_idx]), 4),
            "section": section,
        })

    # Downsample brain activations for frontend (every vertex is too many)
    # Send every 20th vertex = ~1024 vertices per frame
    step = 20
    brain_activations = predictions[:, ::step].tolist()

    return {
        "metrics": metrics,
        "z_scores": z_scores,
        "temporal_hotspots": temporal_hotspots,
        "timeseries": timeseries,
        "timestamps": timestamps,
        "brain_activations": brain_activations,
    }


def _load_baselines() -> dict:
    """Load baseline statistics from file or use defaults."""
    baselines_file = settings.baselines_dir / "baselines.json"
    if baselines_file.exists():
        with open(baselines_file) as f:
            return json.load(f)
    return DEFAULT_BASELINES


def interpret_z_score(z: float) -> str:
    """Convert a z-score to a human-readable interpretation."""
    for (lo, hi), label in Z_SCORE_INTERPRETATION.items():
        if lo <= z < hi:
            return label
    return "normal"
