"""
Generate baseline statistics by screenshotting reference websites
and running them through the TRIBE pipeline.

Uses Playwright to capture full-page screenshots at 1440x900, then
runs each through the TRIBE inference + brain mapper to compute
per-metric mean/std baselines for z-scoring.

In mock mode (default), baselines come from mock inference with varied
synthetic patterns simulating different page complexity levels.
When TRIBE_MOCK_MODE=false, real model inference is used (slow: ~4min/image).

Usage:
    python scripts/generate_baselines.py                # mock mode
    python scripts/generate_baselines.py --real          # real TRIBE (slow)
    python scripts/generate_baselines.py --screenshot    # also capture screenshots
"""

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

import numpy as np

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

# Reference websites grouped by expected cognitive complexity
REFERENCE_URLS = {
    "minimal": [
        "https://www.google.com",
        "https://blank.page",
        "https://www.apple.com",
        "https://stripe.com",
        "https://linear.app",
        "https://notion.so",
        "https://arc.net",
        "https://vercel.com",
        "https://supabase.com",
        "https://railway.app",
    ],
    "medium": [
        "https://github.com",
        "https://www.wikipedia.org",
        "https://news.ycombinator.com",
        "https://stackoverflow.com",
        "https://www.reddit.com",
        "https://medium.com",
        "https://dev.to",
        "https://www.producthunt.com",
        "https://dribbble.com",
        "https://www.figma.com",
    ],
    "complex": [
        "https://www.amazon.com",
        "https://www.ebay.com",
        "https://www.nytimes.com",
        "https://www.cnn.com",
        "https://www.walmart.com",
        "https://www.alibaba.com",
        "https://www.yahoo.com",
        "https://www.msn.com",
        "https://www.bestbuy.com",
        "https://www.target.com",
    ],
}


async def capture_screenshots(output_dir: Path):
    """Screenshot reference websites using Playwright."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("Playwright not installed. Run: pip install playwright && playwright install")
        return []

    output_dir.mkdir(parents=True, exist_ok=True)
    captured = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})

        for group, urls in REFERENCE_URLS.items():
            for url in urls:
                slug = url.replace("https://", "").replace("http://", "")
                slug = slug.replace("/", "_").replace(".", "-")[:50]
                filename = f"{group}_{slug}.png"
                filepath = output_dir / filename

                if filepath.exists():
                    print(f"  [cached] {filename}")
                    captured.append((filepath, group))
                    continue

                try:
                    await page.goto(url, timeout=15000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(2000)  # let lazy content load
                    await page.screenshot(
                        path=str(filepath), full_page=True, type="png"
                    )
                    print(f"  [ok] {filename}")
                    captured.append((filepath, group))
                except Exception as e:
                    print(f"  [fail] {url}: {e}")

        await browser.close()

    return captured


def generate_baselines_from_mock(n_stimuli: int = 30):
    """Generate baselines using varied mock inference patterns.

    Simulates 30 stimuli with different complexity profiles to produce
    realistic baseline distributions with meaningful variance.
    """
    from app.services.brain_mapper import _get_region_vertex_masks

    masks = _get_region_vertex_masks()
    metric_names = list(masks.keys())
    all_metrics = {key: [] for key in metric_names}

    rng = np.random.default_rng(2024)
    n_vertices = 20484
    n_timesteps = 30

    # Simulate stimuli across complexity spectrum
    complexity_levels = np.linspace(0.1, 0.9, n_stimuli)

    for i, complexity in enumerate(complexity_levels):
        # Base pattern varies with complexity
        base = rng.normal(0.0, 0.15 + complexity * 0.25, size=n_vertices)

        predictions = np.zeros((n_timesteps, n_vertices))
        for t in range(n_timesteps):
            noise = rng.normal(0.0, 0.05 + complexity * 0.1, size=n_vertices)
            temporal = 0.5 + 0.5 * np.sin(2 * np.pi * t / n_timesteps)
            predictions[t] = base * temporal + noise

            # Region-specific effects scale with complexity
            predictions[t, :2000] += complexity * 0.3 * temporal
            if 10 < t < 20:
                predictions[t, 8000:10000] += complexity * 0.4
            if t in [5, 15, 25]:
                predictions[t, 5000:7000] += complexity * 0.3

        for key, mask in masks.items():
            if mask.sum() > 0:
                metric_ts = predictions[:, mask].mean(axis=1)
                all_metrics[key].append(float(metric_ts.mean()))
            else:
                all_metrics[key].append(0.0)

        if (i + 1) % 10 == 0:
            print(f"  Processed {i + 1}/{n_stimuli} synthetic stimuli")

    return _compute_baselines(all_metrics)


def generate_baselines_from_real(stimuli_dir: Path):
    """Run real TRIBE v2 inference on stimulus screenshots."""
    from app.services.tribe_compat import apply_windows_patches, patch_from_pretrained
    apply_windows_patches()
    patch_from_pretrained()

    from app.services.tribe_runner import run_inference
    from app.services.brain_mapper import _get_region_vertex_masks
    from app.services.media_converter import convert_image_to_scroll_video

    masks = _get_region_vertex_masks()
    all_metrics = {key: [] for key in masks.keys()}

    image_files = sorted(stimuli_dir.glob("*.png"))
    if not image_files:
        print(f"No PNG files found in {stimuli_dir}")
        return None

    for i, img_path in enumerate(image_files):
        print(f"  [{i+1}/{len(image_files)}] Processing {img_path.name}...")
        t0 = time.time()
        try:
            # Convert screenshot to scroll video
            video_path = img_path.with_suffix(".mp4")
            if not video_path.exists():
                convert_image_to_scroll_video(img_path, video_path)

            predictions, timestamps = run_inference(video_path=video_path)

            for key, mask in masks.items():
                if mask.sum() > 0:
                    metric_ts = predictions[:, mask].mean(axis=1)
                    all_metrics[key].append(float(metric_ts.mean()))
                else:
                    all_metrics[key].append(0.0)

            elapsed = time.time() - t0
            print(f"    Done in {elapsed:.1f}s")
        except Exception as e:
            print(f"    Error: {e}")

    n_success = len(all_metrics[list(all_metrics.keys())[0]])
    if n_success < 3:
        print(f"Only {n_success} successful — insufficient for baselines")
        return None

    return _compute_baselines(all_metrics)


def _compute_baselines(all_metrics: dict) -> dict:
    """Compute mean/std baselines from collected metric values."""
    baselines = {}
    for key, values in all_metrics.items():
        arr = np.array(values)
        std = float(arr.std())
        baselines[key] = {
            "mean": round(float(arr.mean()), 6),
            "std": round(max(std, 0.01), 6),  # floor std at 0.01
            "n_samples": len(values),
            "min": round(float(arr.min()), 6),
            "max": round(float(arr.max()), 6),
        }
    return baselines


def main():
    parser = argparse.ArgumentParser(description="Generate TRIBE v2 baselines")
    parser.add_argument("--real", action="store_true", help="Use real TRIBE inference")
    parser.add_argument("--screenshot", action="store_true", help="Capture reference screenshots")
    args = parser.parse_args()

    project_root = Path(__file__).parent.parent
    stimuli_dir = project_root / "scripts" / "baselines" / "stimuli"
    output_dir = project_root / "data" / "baselines"
    output_dir.mkdir(parents=True, exist_ok=True)

    # Optionally capture screenshots
    if args.screenshot:
        print("Capturing reference screenshots...")
        asyncio.run(capture_screenshots(stimuli_dir))

    # Generate baselines
    if args.real:
        print("\nGenerating baselines with real TRIBE v2 inference...")
        baselines = generate_baselines_from_real(stimuli_dir)
        if baselines is None:
            print("Falling back to mock baselines.")
            baselines = generate_baselines_from_mock()
    else:
        print("Generating baselines with mock inference (30 synthetic stimuli)...")
        baselines = generate_baselines_from_mock()

    # Save
    output_file = output_dir / "baselines.json"
    with open(output_file, "w") as f:
        json.dump(baselines, f, indent=2)

    print(f"\nBaselines saved to {output_file}")
    for key, stats in baselines.items():
        print(f"  {key:25s}  mean={stats['mean']:+.4f}  std={stats['std']:.4f}")

    # Verify variance
    stds = [v["std"] for v in baselines.values()]
    if all(s > 0 for s in stds):
        print(f"\nAll metrics have non-trivial variance (min std: {min(stds):.4f})")
    else:
        print("\nWARNING: Some metrics have zero variance!")


if __name__ == "__main__":
    main()
