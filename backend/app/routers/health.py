from fastapi import APIRouter

from app.config import settings
from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check():
    model_loaded = False
    if not settings.tribe_mock_mode:
        from app.dependencies import get_tribe_model
        model_loaded = get_tribe_model() is not None
    return HealthResponse(
        status="ok",
        tribe_mock_mode=settings.tribe_mock_mode,
        model_loaded=model_loaded,
    )
