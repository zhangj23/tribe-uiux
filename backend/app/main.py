from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from app.config import settings
from app.routers import upload, jobs, health, analyze_url, compare


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

# Serve frontend static files with Cache-Control headers
app.mount("/css", CachedStaticFiles(directory=str(settings.frontend_dir / "css")), name="css")
app.mount("/js", CachedStaticFiles(directory=str(settings.frontend_dir / "js")), name="js")
app.mount("/assets", CachedStaticFiles(directory=str(settings.frontend_dir / "assets")), name="assets")


# Catch-all: serve index.html for the root and any non-API path
@app.get("/")
async def serve_index():
    return FileResponse(str(settings.frontend_dir / "index.html"))
