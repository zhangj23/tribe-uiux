"""Windows compatibility patches for TRIBE v2 and its dependencies.

TRIBE v2 is a research model built for Linux. On Windows it has several issues:
1. PosixPath in config.yaml crashes yaml.UnsafeLoader
2. Path('facebook/tribev2') becomes 'facebook\\tribev2', breaking HF repo IDs
3. submitit uses POSIX signals (SIGKILL, SIGCONT, SIGUSR2) that don't exist
4. ViT-G backbone needs ~10GB+ VRAM; 6GB GPUs must fall back to CPU
"""

import os
import pathlib
import signal
import sys

import torch


def apply_windows_patches():
    """Apply all necessary Windows compatibility patches for TRIBE v2."""
    if sys.platform != "win32":
        return

    # 1. PosixPath -> WindowsPath so yaml.UnsafeLoader can deserialize configs
    pathlib.PosixPath = pathlib.WindowsPath

    # 2. Add fake POSIX signals for submitit subprocess compatibility
    if not hasattr(signal, "SIGKILL"):
        signal.SIGKILL = signal.SIGTERM
    if not hasattr(signal, "SIGCONT"):
        signal.SIGCONT = signal.SIGTERM
    if not hasattr(signal, "SIGUSR1"):
        signal.SIGUSR1 = getattr(signal, "SIGBREAK", signal.SIGTERM)

    # 3. Suppress HF symlink warnings
    os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"


def detect_device() -> str:
    """Choose the best available device, respecting VRAM limits."""
    if not torch.cuda.is_available():
        return "cpu"
    vram_gb = torch.cuda.get_device_properties(0).total_memory / 1024**3
    # TRIBE v2 ViT-G needs ~10GB+ VRAM
    if vram_gb < 10:
        return "cpu"
    return "cuda"


def patch_from_pretrained():
    """Monkey-patch TribeModel.from_pretrained to fix Windows path handling.

    The original code does `Path(checkpoint_dir)` which on Windows converts
    'facebook/tribev2' to 'facebook\\tribev2', breaking HuggingFace repo
    ID validation. This patch preserves the original string for HF downloads.
    """
    import yaml
    from pathlib import Path

    from huggingface_hub import hf_hub_download

    import tribev2.demo_utils as du

    @classmethod
    def patched_from_pretrained(
        cls,
        checkpoint_dir="facebook/tribev2",
        checkpoint_name="best.ckpt",
        cache_folder="./cache",
        config_update=None,
        cluster="local",
        device="auto",
    ):
        if cache_folder is not None:
            Path(cache_folder).mkdir(parents=True, exist_ok=True)
        if device == "auto":
            device = detect_device()

        checkpoint_path = Path(checkpoint_dir)
        if checkpoint_path.exists():
            config_path = checkpoint_path / "config.yaml"
            ckpt_path = checkpoint_path / checkpoint_name
        else:
            # Use original string as repo ID — NOT str(Path(...))
            repo_id = checkpoint_dir
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
        config["checkpoint_path"] = (
            str(config["infra.folder"]) + f"/{checkpoint_name}"
        )
        config["cache_folder"] = (
            str(cache_folder) if cache_folder is not None else "./cache"
        )
        if config_update is not None:
            config.update(config_update)
        xp = cls(**config)

        du.logger.info(f"Loading model from {ckpt_path}")
        ckpt = torch.load(
            ckpt_path, map_location="cpu", weights_only=True, mmap=True
        )
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
