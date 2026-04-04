"""
One-time script: Export fsaverage5 mesh coordinates to 2D JSON
for the frontend brain heatmap visualization.

Usage: python scripts/export_brain_templates.py
"""

import json
import numpy as np
from pathlib import Path


def export_templates():
    try:
        from nilearn.datasets import load_fsaverage

        fsaverage = load_fsaverage(mesh="fsaverage5")

        # Load mesh coordinates
        from nilearn.surface import load_surf_mesh
        coords_lh, _ = load_surf_mesh(fsaverage["pial_left"])
        coords_rh, _ = load_surf_mesh(fsaverage["pial_right"])

        # Project 3D to 2D (top-down view: use x, y coordinates)
        # Downsample to every 20th vertex to match backend output
        step = 20

        lh_2d = [
            {"x": float(coords_lh[i, 0]), "y": float(coords_lh[i, 1])}
            for i in range(0, len(coords_lh), step)
        ]

        rh_2d = [
            {"x": float(coords_rh[i, 0]), "y": float(coords_rh[i, 1])}
            for i in range(0, len(coords_rh), step)
        ]

        output_dir = Path(__file__).parent.parent / "frontend" / "assets"
        output_dir.mkdir(parents=True, exist_ok=True)

        with open(output_dir / "brain-template-lh.json", "w") as f:
            json.dump(lh_2d, f)

        with open(output_dir / "brain-template-rh.json", "w") as f:
            json.dump(rh_2d, f)

        print(f"Exported {len(lh_2d)} LH vertices, {len(rh_2d)} RH vertices")

    except ImportError:
        print("nilearn not installed. Using procedural brain layout in frontend instead.")


if __name__ == "__main__":
    export_templates()
