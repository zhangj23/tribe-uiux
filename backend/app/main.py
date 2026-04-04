from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse


class CacheControlMiddleware(BaseHTTPMiddleware):
    """Set Cache-Control on static assets (CSS/JS)."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        path = request.url.path
        if path.startswith("/css/") or path.startswith("/js/"):
            response.headers["Cache-Control"] = "public, max-age=3600"
        return response

from app.config import settings
from app.routers import upload, jobs, health, analyze_url, compare


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
app.add_middleware(CacheControlMiddleware)

# API routes (must be registered before static files)
app.include_router(health.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(analyze_url.router, prefix="/api")
app.include_router(compare.router, prefix="/api")

# Serve frontend static files under /static path
app.mount("/css", StaticFiles(directory=str(settings.frontend_dir / "css")), name="css")
app.mount("/js", StaticFiles(directory=str(settings.frontend_dir / "js")), name="js")
app.mount("/assets", StaticFiles(directory=str(settings.frontend_dir / "assets")), name="assets")


# Catch-all: serve index.html for the root and any non-API path
@app.get("/")
async def serve_index():
    return FileResponse(str(settings.frontend_dir / "index.html"))
