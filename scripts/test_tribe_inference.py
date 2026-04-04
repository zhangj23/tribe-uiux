"""Test real TRIBE v2 inference on a video file."""
import pathlib
import sys
import time
import os

# Windows compat: PosixPath -> WindowsPath
if sys.platform == 'win32':
    pathlib.PosixPath = pathlib.WindowsPath

# Ensure ffmpeg is on PATH
os.environ['PATH'] = os.environ.get('PATH', '') + r';C:\Users\Jzgam\AppData\Local\ffmpeg-bin'
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

import signal
import torch

# Patch missing POSIX signals on Windows for submitit compatibility
if sys.platform == 'win32':
    if not hasattr(signal, 'SIGKILL'):
        signal.SIGKILL = signal.SIGTERM
    if not hasattr(signal, 'SIGCONT'):
        signal.SIGCONT = signal.SIGTERM
    if not hasattr(signal, 'SIGUSR1'):
        signal.SIGUSR1 = signal.SIGBREAK


def _patch_tribe_from_pretrained():
    """Monkey-patch TribeModel.from_pretrained to fix Windows path issues.

    The original code does Path(checkpoint_dir) which converts 'facebook/tribev2'
    to 'facebook\\tribev2' on Windows, breaking HuggingFace repo ID validation.
    """
    import tribev2.demo_utils as du
    import yaml
    from pathlib import Path
    from huggingface_hub import hf_hub_download

    _original = du.TribeModel.from_pretrained.__func__

    @classmethod
    def patched_from_pretrained(
        cls,
        checkpoint_dir="facebook/tribev2",
        checkpoint_name="checkpoint_average.pt",
        cache_folder="./cache",
        config_update=None,
        cluster="local",
        device="auto",
    ):
        if cache_folder is not None:
            Path(cache_folder).mkdir(parents=True, exist_ok=True)
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"

        checkpoint_path = Path(checkpoint_dir)
        if checkpoint_path.exists():
            config_path = checkpoint_path / "config.yaml"
            ckpt_path = checkpoint_path / checkpoint_name
        else:
            # Keep repo_id as the original string, NOT str(Path(...))
            repo_id = checkpoint_dir  # <-- THE FIX: use original string
            config_path = hf_hub_download(repo_id, "config.yaml")
            ckpt_path = hf_hub_download(repo_id, checkpoint_name)

        with open(config_path, "r") as f:
            config = du.ConfDict(yaml.load(f, Loader=yaml.UnsafeLoader))
        for modality in ["text", "audio", "video"]:
            config[f"data.{modality}_feature.infra.folder"] = cache_folder
            config[f"data.{modality}_feature.infra.cluster"] = cluster
        for param in [
            "infra.workdir",
            "data.study.infra_timelines",
            "data.neuro.infra",
            "data.image_feature.infra",
        ]:
            config.pop(param)
        config["data.study.path"] = "."
        config["average_subjects"] = True
        config["checkpoint_path"] = str(config["infra.folder"]) + f"/{checkpoint_name}"
        config["cache_folder"] = (
            str(cache_folder) if cache_folder is not None else "./cache"
        )
        if config_update is not None:
            config.update(config_update)
        xp = cls(**config)

        du.logger.info(f"Loading model from {ckpt_path}")
        ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=True, mmap=True)
        build_args = ckpt["model_build_args"]
        state_dict = {
            k.removeprefix("model."): v for k, v in ckpt["state_dict"].items()
        }
        del ckpt

        model = xp.brain_model_config.build(**build_args)
        model.load_state_dict(state_dict, strict=True, assign=True)
        del state_dict
        model.to(device)
        model.eval()

        xp._model = model
        return xp

    du.TribeModel.from_pretrained = patched_from_pretrained


def main():
    print(f'CUDA: {torch.cuda.is_available()}')
    if torch.cuda.is_available():
        print(f'GPU: {torch.cuda.get_device_name(0)}')
        vram_gb = torch.cuda.get_device_properties(0).total_memory / 1024**3
        print(f'VRAM: {vram_gb:.1f} GB')
        if vram_gb < 10:
            print('WARNING: VRAM < 10GB, using CPU mode (ViT-G needs ~10GB+)')
            device = 'cpu'
        else:
            device = 'cuda'
    else:
        device = 'cpu'
        print('No CUDA, using CPU')

    _patch_tribe_from_pretrained()

    print(f'\nLoading TRIBE v2 on {device}...')
    t0 = time.time()
    from tribev2 import TribeModel
    model = TribeModel.from_pretrained(
        'facebook/tribev2',
        checkpoint_name='best.ckpt',
        device=device,
    )
    t1 = time.time()
    print(f'Model loaded in {t1 - t0:.1f}s')

    video_path = os.path.join('data', 'uploads', 'test_small.mp4')
    if not os.path.exists(video_path):
        print('Creating test video...')
        os.makedirs(os.path.dirname(video_path), exist_ok=True)
        import subprocess
        from PIL import Image
        import numpy as np
        img = np.zeros((360, 640, 3), dtype=np.uint8)
        img[100:200, 150:490, :] = [200, 50, 50]
        img[220:260, 200:440, :] = 255
        png_path = os.path.join('data', 'uploads', 'test_small.png')
        Image.fromarray(img).save(png_path)
        subprocess.run([
            'ffmpeg', '-y', '-loop', '1', '-i', png_path,
            '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '10',
            video_path
        ], capture_output=True, check=True)

    print(f'\nCreating events from {video_path}...')
    t2 = time.time()
    df = model.get_events_dataframe(video_path=video_path)
    t3 = time.time()
    print(f'Events created in {t3 - t2:.1f}s, shape: {df.shape}')

    print('\nRunning prediction (CPU mode — this may take several minutes)...')
    t4 = time.time()
    preds, segments = model.predict(events=df)
    t5 = time.time()
    print(f'Prediction done in {t5 - t4:.1f}s')
    print(f'Predictions shape: {preds.shape}')
    print(f'Predictions range: [{preds.min():.4f}, {preds.max():.4f}]')
    print(f'Predictions mean: {preds.mean():.4f}, std: {preds.std():.4f}')
    print(f'\nTotal pipeline time: {t5 - t0:.1f}s')
    print('\nSUCCESS: TRIBE v2 inference completed')


if __name__ == '__main__':
    main()
