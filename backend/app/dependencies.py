from app.config import settings

# Singleton for TRIBE model (loaded once at startup)
_tribe_model = None


def get_tribe_model():
    global _tribe_model
    if settings.tribe_mock_mode:
        return None  # Mock mode doesn't need the real model
    if _tribe_model is None:
        from app.services.tribe_compat import (
            apply_windows_patches,
            detect_device,
            patch_from_pretrained,
        )

        apply_windows_patches()
        patch_from_pretrained()

        from tribev2 import TribeModel

        device = detect_device()
        _tribe_model = TribeModel.from_pretrained(
            "facebook/tribev2",
            checkpoint_name="best.ckpt",
            cache_folder=settings.tribe_cache_dir,
            device=device,
        )
    return _tribe_model
