from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
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


class CachedStaticFiles(StaticFiles):
    """StaticFiles with Cache-Control headers."""

    async def get_response(self, *args, **kwargs):
        response = await super().get_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=3600"
        return response


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

# API routes (must be registered before static files)
app.include_router(health.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(analyze_url.router, prefix="/api")
app.include_router(compare.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(runs.router, prefix="/api")

# Serve legacy frontend static files (only when the directory exists — it won't
# in the Docker container when the Next.js frontend is the primary UI).
_frontend_dir = settings.frontend_dir
if _frontend_dir.is_dir():
    for sub in ("css", "js", "assets"):
        sub_dir = _frontend_dir / sub
        if sub_dir.is_dir():
            app.mount(f"/{sub}", CachedStaticFiles(directory=str(sub_dir)), name=sub)

    @app.get("/")
    async def serve_index():
        index = _frontend_dir / "index.html"
        if index.is_file():
            return FileResponse(str(index))
        return {"detail": "Frontend not mounted — use the Next.js app on port 3000"}
else:
    @app.get("/")
    async def serve_index():
        return {"detail": "API-only mode — use the Next.js frontend on port 3000"}
