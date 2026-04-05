from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Paths
    base_dir: Path = Path(__file__).resolve().parent.parent
    upload_dir: Path = base_dir / "data" / "uploads"
    baselines_dir: Path = base_dir / "data" / "baselines"
    frontend_dir: Path = base_dir / "frontend"

    # TRIBE v2
    tribe_mock_mode: bool = True  # Set False when real TRIBE is installed
    tribe_cache_dir: str = "./cache"
    tribe_device: str = "cuda"  # "cuda" or "cpu"

    # LLM
    anthropic_api_key: str = ""

    # Media conversion
    scroll_speed_px_per_sec: int = 200
    viewport_width: int = 1920
    viewport_height: int = 1080

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

# Ensure directories exist
settings.upload_dir.mkdir(parents=True, exist_ok=True)
settings.baselines_dir.mkdir(parents=True, exist_ok=True)
