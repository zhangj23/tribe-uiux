"""POST /api/analyze/url — accept a URL, screenshot it, run the pipeline."""

import asyncio
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import CurrentUser, get_optional_user
from app.config import settings
from app.models.schemas import UploadResponse
from app.services.job_manager import create_job, submit_pipeline
from app.services.pipeline import run_pipeline

router = APIRouter(tags=["analyze"])

# Basic URL validation
_URL_RE = re.compile(r"^https?://[^\s<>\"']+$")


class URLRequest(BaseModel):
    url: str


async def _screenshot_url(url: str, output_path: Path) -> Path:
    """Capture a full-page screenshot of a URL using Playwright."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Playwright not installed. Run: pip install playwright && npx playwright install",
        )

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})

        try:
            await page.goto(url, timeout=20000, wait_until="domcontentloaded")
        except Exception as e:
            await browser.close()
            err_msg = str(e)
            if "net::ERR_NAME_NOT_RESOLVED" in err_msg:
                raise HTTPException(status_code=400, detail=f"URL not reachable: domain not found")
            if "net::ERR_CONNECTION_REFUSED" in err_msg:
                raise HTTPException(status_code=400, detail=f"URL not reachable: connection refused")
            if "Timeout" in err_msg:
                raise HTTPException(status_code=400, detail=f"URL timed out after 20 seconds")
            raise HTTPException(status_code=400, detail=f"Failed to load URL: {err_msg[:200]}")

        # Wait for lazy content
        await page.wait_for_timeout(2000)

        # Full page screenshot, capped at 5000px height
        await page.screenshot(
            path=str(output_path),
            full_page=True,
            type="png",
        )

        # Check if the screenshot is too tall and crop if needed
        await browser.close()

    return output_path


@router.post("/analyze/url", response_model=UploadResponse)
async def analyze_url(
    request: URLRequest,
    user: CurrentUser | None = Depends(get_optional_user),
):
    if settings.auth_required and user is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    url = request.url.strip()

    # Validate URL
    if not _URL_RE.match(url):
        raise HTTPException(status_code=400, detail="Invalid URL. Must start with http:// or https://")

    parsed = urlparse(url)
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="Invalid URL: no hostname")

    # Generate filename from URL
    slug = parsed.hostname.replace(".", "-")
    if parsed.path and parsed.path != "/":
        slug += parsed.path.replace("/", "-")[:30]
    slug = re.sub(r"[^a-zA-Z0-9\-]", "", slug)[:60]
    filename = f"url_{slug}.png"

    # Screenshot the URL
    save_path = settings.upload_dir / filename
    settings.upload_dir.mkdir(parents=True, exist_ok=True)

    await _screenshot_url(url, save_path)

    if not save_path.exists():
        raise HTTPException(status_code=500, detail="Screenshot capture failed")

    # Create job and start pipeline (same as file upload)
    job = create_job(
        media_type="image",
        input_path=save_path,
        owner_id=user.id if user else None,
    )
    submit_pipeline(job, run_pipeline)

    return UploadResponse(job_id=job.id)
