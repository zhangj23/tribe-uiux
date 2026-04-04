"""
One-time script: Run TRIBE v2 on baseline stimuli to compute
statistical baselines for z-scoring.

This script requires:
1. TRIBE v2 installed (pip install git+https://github.com/facebookresearch/tribev2.git)
2. Baseline stimuli in data/baseline_stimuli/

For now, generates synthetic baselines for development.

Usage: python scripts/generate_baselines.py
"""

import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))


def generate_real_baselines():
    """Run TRIBE on actual baseline stimuli."""
    from app.services.tribe_runner import run_inference
    from app.services.brain_mapper import _get_region_vertex_masks

    import numpy as np

    stimuli_dir = Path(__file__).parent.parent / "data" / "baseline_stimuli"
    if not stimuli_dir.exists():
        print(f"No baseline stimuli found at {stimuli_dir}")
        print("Place video/audio files there and re-run.")
        return generate_synthetic_baselines()

    masks = _get_region_vertex_masks()
    all_metrics = {key: [] for key in masks.keys()}

    for media_file in stimuli_dir.iterdir():
        if media_file.suffix.lower() in {'.mp4', '.mov', '.avi', '.mkv'}:
            print(f"Processing {media_file.name}...")
            try:
                predictions, timestamps = run_inference(video_path=media_file)
                for key, mask in masks.items():
                    metric_ts = predictions[:, mask].mean(axis=1)
                    all_metrics[key].append(float(metric_ts.mean()))
            except Exception as e:
                print(f"  Error: {e}")

    if not all_metrics[list(all_metrics.keys())[0]]:
        print("No successful inferences. Using synthetic baselines.")
        return generate_synthetic_baselines()

    baselines = {}
    for key, values in all_metrics.items():
        arr = np.array(values)
        baselines[key] = {
            "mean": float(arr.mean()),
            "std": float(arr.std()) if len(arr) > 1 else 0.1,
        }

    return baselines


def generate_synthetic_baselines():
    """Generate reasonable default baselines for development."""
    return {
        "visual_processing": {"mean": 0.35, "std": 0.12},
        "object_recognition": {"mean": 0.25, "std": 0.10},
        "reading_language": {"mean": 0.20, "std": 0.08},
        "attention_salience": {"mean": 0.30, "std": 0.11},
        "cognitive_load": {"mean": 0.28, "std": 0.09},
        "emotional_response": {"mean": 0.18, "std": 0.07},
    }


def main():
    output_dir = Path(__file__).parent.parent / "data" / "baselines"
    output_dir.mkdir(parents=True, exist_ok=True)

    try:
        baselines = generate_real_baselines()
    except ImportError:
        print("TRIBE v2 not installed. Using synthetic baselines.")
        baselines = generate_synthetic_baselines()

    output_file = output_dir / "baselines.json"
    with open(output_file, "w") as f:
        json.dump(baselines, f, indent=2)

    print(f"\nBaselines saved to {output_file}")
    print(json.dumps(baselines, indent=2))


if __name__ == "__main__":
    main()
