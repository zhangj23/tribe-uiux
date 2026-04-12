from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from app.config import settings
from app.routers import (
    analyze_url,
    compare,
    health,
    jobs,
    projects,
    runs,
    upload,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: preload TRIBE model if not in mock mode
    if not settings.tribe_mock_mode:
        from app.dependencies import get_tribe_model
        get_tribe_model()
        print("TRIBE v2 model loaded")
    else:
        print("Running in MOCK mode (no real TRIBE inference)")
    yield
    # Shutdown
    print("Shutting down")


app = FastAPI(
    title="TRIBE UX Analyzer",
    description="Neural-driven UX analysis using Meta's TRIBE v2",
    version="0.1.0",
    lifespan=lifespan,
)

_cors_origins = [
    origin.strip()
    for origin in (settings.cors_origins or "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins or ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=500)

# API routes
app.include_router(health.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(analyze_url.router, prefix="/api")
app.include_router(compare.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(runs.router, prefix="/api")
