from app.config import settings

# Singleton for TRIBE model (loaded once at startup)
_tribe_model = None


def get_tribe_model():
    global _tribe_model
    if settings.tribe_mock_mode:
        return None  # Mock mode doesn't need the real model
    if _tribe_model is None:
        from tribev2 import TribeModel
        _tribe_model = TribeModel.from_pretrained(
            "facebook/tribev2",
            cache_folder=settings.tribe_cache_dir,
        )
    return _tribe_model
