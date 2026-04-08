from pathlib import Path
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Paths
    base_dir: Path = Path(__file__).resolve().parent.parent
    upload_dir: Path = base_dir / "data" / "uploads"
    baselines_dir: Path = base_dir / "data" / "baselines"

    # TRIBE v2
    tribe_mock_mode: bool = True  # Set False when real TRIBE is installed
    tribe_cache_dir: str = "./cache"
    tribe_device: str = "auto"  # "cuda", "cpu", or "auto" (detect VRAM)

    # RunPod Serverless (set both to use GPU inference via RunPod)
    runpod_endpoint_id: str = ""  # e.g. "abc123xyz" from RunPod dashboard
    runpod_api_key: str = ""  # RunPod API key

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
