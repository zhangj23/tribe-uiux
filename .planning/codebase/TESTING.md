# Testing Patterns

**Analysis Date:** 2026-04-05

## Test Framework

**Runner:**
- Pytest is *NOT* installed (no entry in `backend/requirements.txt`)
- Playwright installed for frontend E2E testing (`package.json` devDependencies)
- No test suite currently exists: `backend/tests/` directory is empty

**Assertion Library:**
- None configured for backend
- Playwright provides assertions (when E2E tests are written)

**Run Commands:**
- Backend: No test runner command available. To add tests, would run:
  ```bash
  pytest  # After adding pytest to requirements.txt
  ```
- Frontend: `npm test` currently returns error (see `package.json`)
  ```json
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  }
  ```

**Recommendation for Adding Tests:**
```bash
# Backend: add pytest and dependencies
cd backend
pip install pytest pytest-asyncio httpx

# Run tests
pytest

# Watch mode
pytest --watch

# Coverage
pytest --cov=app
```

## Test File Organization

**Location (Backend):**
- Tests should live in `backend/tests/` directory (exists but empty)
- Pattern: `test_*.py` or `*_test.py` (pytest convention)
- Recommended structure:
  ```
  backend/tests/
  ├── conftest.py              # Shared fixtures
  ├── test_routers/
  │   ├── test_upload.py
  │   ├── test_jobs.py
  │   └── test_health.py
  ├── test_services/
  │   ├── test_brain_mapper.py
  │   ├── test_pipeline.py
  │   └── test_tribe_runner.py
  └── test_models/
      └── test_schemas.py
  ```

**Location (Frontend):**
- E2E tests in `tests/` or `e2e/` directory (not yet created)
- Pattern: `*.spec.js` for Playwright tests
- Recommended:
  ```
  tests/e2e/
  ├── upload.spec.js
  ├── polling.spec.js
  ├── results.spec.js
  └── compare.spec.js
  ```

**Naming:**
- Backend: `test_<module>.py` (e.g., `test_upload.py`)
- Frontend: `<feature>.spec.js` (e.g., `upload.spec.js`)

## Test Structure

**Backend Pattern (from requirements analysis):**

Typical pytest + FastAPI async test structure (not yet implemented):

```python
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    return TestClient(app)

def test_upload_valid_file(client):
    """Test successful file upload."""
    with open("tests/fixtures/test.png", "rb") as f:
        response = client.post(
            "/api/upload",
            files={"file": ("test.png", f, "image/png")}
        )
    assert response.status_code == 200
    assert "job_id" in response.json()

def test_upload_unsupported_file(client):
    """Test rejection of unsupported file type."""
    with open("tests/fixtures/test.txt", "rb") as f:
        response = client.post(
            "/api/upload",
            files={"file": ("test.txt", f, "text/plain")}
        )
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]

@pytest.mark.asyncio
async def test_get_job_status(client):
    """Test polling for job status."""
    # Create a job first
    response = client.post("/api/jobs/test-id")
    assert response.status_code == 200
```

**Patterns Observed in Codebase:**
- No fixtures currently used
- No test data/mocks setup
- Background thread jobs not testable in isolation without refactoring (executor runs in module scope)

**Frontend Pattern (Playwright, not yet implemented):**

```javascript
// tests/e2e/upload.spec.js
import { test, expect } from '@playwright/test';

test.describe('Upload View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:9100');
  });

  test('should upload image file successfully', async ({ page }) => {
    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles('tests/fixtures/test.png');
    
    const analyzeBtn = page.locator('#analyzeBtn');
    await analyzeBtn.click();
    
    // Should transition to processing view
    const processingView = page.locator('#viewProcessing');
    await expect(processingView).toHaveClass(/view--active/);
  });

  test('should validate file size', async ({ page }) => {
    // Attempt to upload file > 100MB
    // Should show error message
    const errorEl = page.locator('#uploadError');
    await expect(errorEl).toContainText('File too large');
  });
});
```

## Mocking

**Framework (Backend - if added):**
- Use `unittest.mock` (standard library) for Python mocking
- Use `pytest-mock` for pytest-integrated mocking

**Patterns Observed (Mock Mode):**

The codebase already uses an internal "mock mode" pattern rather than unit test mocks:

1. **Mock TRIBE Inference** (`tribe_runner.py`):
   ```python
   if settings.tribe_mock_mode:
       return _mock_inference(video_path or audio_path)
   ```
   - `_mock_inference()` generates realistic synthetic neural data
   - Activated via `TRIBE_MOCK_MODE=true` environment variable
   - Simulates temporal dynamics and region-specific spikes
   - No GPU/model required

2. **Mock Brain Mapper Fallback** (`brain_mapper.py`):
   ```python
   try:
       from nilearn.datasets import fetch_atlas_surf_destrieux
       # Real atlas loading
   except Exception:
       # Fallback: create mock region assignments for development
       _create_mock_region_assignments()
   ```
   - Gracefully degrades if nilearn unavailable
   - Creates reasonable fake vertex-to-region mappings

3. **Mock LLM Analysis** (`llm_interpreter.py`):
   ```python
   if not settings.anthropic_api_key:
       logger.info("No API key configured — using mock analysis")
       return _mock_analysis(z_scores, temporal_hotspots), _estimate_friction(z_scores)
   ```
   - Generates plausible analysis when API key absent
   - Useful for frontend development without API costs

**What to Mock (if unit tests added):**

- **File System Operations:**
  - `pathlib.Path.mkdir()`, `.exists()`, `.open()`
  - Use `tempfile.TemporaryDirectory()` for real temp files in tests
  
- **External APIs:**
  - Anthropic API calls → use mock responses or fixture data
  - RunPod Serverless → mock HTTP requests
  
- **Expensive Operations:**
  - TRIBE model inference → use `_mock_inference()` (already built in)
  - Nilearn atlas loading → already has fallback
  
- **Job Store:**
  - Reset `_jobs` dict before each test
  - Consider dependency injection for testability (currently global)

**What NOT to Mock (if unit tests added):**

- Data validation logic (Pydantic models should be tested real)
- Brain region mapping logic (logic is critical, test with real atlas or mock data)
- Z-score calculations (math should be verified, not mocked)
- Error handling paths (test real exceptions, not mocked)

**Example Unit Test Pattern (Recommended):**

```python
# tests/test_services/test_brain_mapper.py
import pytest
import numpy as np
from app.services.brain_mapper import compute_ux_metrics

@pytest.fixture
def mock_predictions():
    """Create realistic mock TRIBE predictions."""
    n_timesteps = 30
    n_vertices = 20484
    rng = np.random.default_rng(42)
    return rng.normal(0.3, 0.1, (n_timesteps, n_vertices))

@pytest.fixture
def timestamps():
    """Create matching timestamps."""
    return [t * 0.33 for t in range(30)]

def test_compute_ux_metrics_shape(mock_predictions, timestamps):
    """Test output structure."""
    result = compute_ux_metrics(mock_predictions, timestamps)
    
    assert "metrics" in result
    assert "z_scores" in result
    assert "timeseries" in result
    assert "temporal_hotspots" in result
    
    # Metrics should have all 6 UX categories
    assert len(result["metrics"]) == 6
    assert set(result["metrics"].keys()) == {
        "visual_processing", "object_recognition", "reading_language",
        "attention_salience", "cognitive_load", "emotional_response"
    }

def test_z_scores_in_reasonable_range(mock_predictions, timestamps):
    """Test z-scores are within expected bounds."""
    result = compute_ux_metrics(mock_predictions, timestamps)
    
    for metric, z in result["z_scores"].items():
        # Z-scores should typically be in range [-3, 3]
        assert -5 <= z <= 5, f"{metric}: z={z} outside expected range"
```

## Fixtures and Factories

**Test Data Location:**
- Not yet created; should be in `backend/tests/fixtures/`

**Recommended Fixtures:**

```
backend/tests/fixtures/
├── test.png              # 100x100 image
├── test.jpg              # Sample photo
├── test_large.bin        # Test file > 100MB (for size validation)
├── test.mp4              # Short video
├── test.wav              # Audio file
└── job_response.json     # Sample API response
```

**Factory Pattern (Backend):**

```python
# tests/conftest.py
import pytest
from datetime import datetime, timezone
from pathlib import Path
from app.services.job_manager import Job

@pytest.fixture
def job_factory():
    """Factory for creating test jobs."""
    def _create_job(media_type="image", status="created", **kwargs):
        return Job(
            id="test-job-123",
            media_type=media_type,
            status=status,
            created_at=datetime.now(timezone.utc),
            **kwargs
        )
    return _create_job

@pytest.fixture
def mock_baselines():
    """Baseline statistics for z-score tests."""
    return {
        "visual_processing": {"mean": 0.35, "std": 0.12},
        "object_recognition": {"mean": 0.25, "std": 0.10},
        "reading_language": {"mean": 0.20, "std": 0.08},
        "attention_salience": {"mean": 0.30, "std": 0.11},
        "cognitive_load": {"mean": 0.28, "std": 0.09},
        "emotional_response": {"mean": 0.18, "std": 0.07},
    }
```

**Frontend Fixtures (Playwright):**

```javascript
// tests/e2e/fixtures.js
import { test as base } from '@playwright/test';

export const test = base.extend({
  fileFixtures: async ({ page }, use) => {
    // Prepare fixture files (upload to temp server)
    const fixtures = {
      testImage: 'tests/fixtures/test.png',
      testVideo: 'tests/fixtures/test.mp4',
    };
    await use(fixtures);
  }
});
```

## Coverage

**Requirements:**
- Not enforced (no CI/CD configured)

**View Coverage (Backend - if tests added):**

```bash
pytest --cov=app --cov-report=html
# Opens htmlcov/index.html
```

**Target Coverage (Recommended):**
- Services: 80%+ (core logic)
- Routers: 70%+ (endpoint validation, error handling)
- Models: 95%+ (data validation)
- Overall: 75%+

## Test Types

**Unit Tests (Backend - to implement):**
- **Scope:** Single function or method in isolation
- **Approach:**
  - Use mocks for external dependencies (API calls, file I/O)
  - Use real data for calculations (z-scores, region mapping)
  - Example: test `interpret_z_score()` in isolation
  
  ```python
  def test_interpret_z_score():
      assert interpret_z_score(-2.0) == "low"
      assert interpret_z_score(0.0) == "normal"
      assert interpret_z_score(1.5) == "elevated"
      assert interpret_z_score(3.0) == "extreme"
  ```

**Integration Tests (Backend - to implement):**
- **Scope:** Multiple components working together (router → service → data)
- **Approach:**
  - Use TestClient to make real HTTP requests
  - Use real (or mocked) job store
  - Example: test full upload→processing→query flow
  
  ```python
  def test_upload_and_poll_workflow(client):
      # Upload file
      response1 = client.post("/api/upload", files={"file": ...})
      job_id = response1.json()["job_id"]
      
      # Poll job (should transition through states)
      import time
      for _ in range(30):
          response2 = client.get(f"/api/jobs/{job_id}")
          if response2.json()["status"] == "completed":
              break
          time.sleep(0.1)
      
      # Verify final result
      assert response2.status_code == 200
      assert "metrics" in response2.json()
  ```

**E2E Tests (Frontend - to implement):**
- **Scope:** Full user workflow from upload to results
- **Approach:**
  - Use Playwright to automate browser
  - Backend must be running
  - Example: test file upload → processing → view results
  
  ```javascript
  test('full analysis workflow', async ({ page }) => {
    await page.goto('http://localhost:9100');
    
    // Upload file
    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles('tests/fixtures/test.png');
    await page.locator('#analyzeBtn').click();
    
    // Wait for processing to complete
    await page.waitForSelector('#viewResults.view--active', { timeout: 30000 });
    
    // Verify results displayed
    const frictionScore = page.locator('#frictionNumber');
    await expect(frictionScore).toBeVisible();
    const score = await frictionScore.textContent();
    expect(score).toMatch(/\d+\.\d/);
  });
  ```

## Common Patterns

**Async Testing (Backend - if tests added):**

```python
@pytest.mark.asyncio
async def test_async_endpoint():
    """Test async endpoint with TestClient."""
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200

# Or with pytest-asyncio:
import pytest_asyncio

@pytest_asyncio.fixture
async def async_client():
    from httpx import AsyncClient
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest.mark.asyncio
async def test_with_async_client(async_client):
    response = await async_client.get("/api/health")
    assert response.status_code == 200
```

**Error Testing (Backend - if tests added):**

```python
def test_upload_invalid_extension(client):
    """Test that invalid file types are rejected."""
    response = client.post(
        "/api/upload",
        files={"file": ("test.txt", b"content", "text/plain")}
    )
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]

def test_job_not_found(client):
    """Test 404 on missing job."""
    response = client.get("/api/jobs/nonexistent")
    assert response.status_code == 404
    assert "Job not found" in response.json()["detail"]

def test_pipeline_handles_corrupted_image(client, tmp_path):
    """Test graceful failure on invalid image."""
    # Create corrupted image
    bad_img = tmp_path / "bad.png"
    bad_img.write_bytes(b"not a real image")
    
    # Upload (will fail in media_converter)
    response = client.post(
        "/api/upload",
        files={"file": ("bad.png", bad_img.read_bytes(), "image/png")}
    )
    job_id = response.json()["job_id"]
    
    # Poll until failure
    import time
    time.sleep(3)  # Wait for background processing
    response = client.get(f"/api/jobs/{job_id}")
    assert response.json()["status"] == "failed"
```

**Frontend Async Testing (Playwright):**

```javascript
test('handles network error gracefully', async ({ page }) => {
  // Simulate network failure
  await page.context().setOffline(true);
  
  await page.locator('#analyzeBtn').click();
  
  // Should show error message
  await expect(page.locator('#uploadError')).toContainText('Upload error');
  
  await page.context().setOffline(false);
});

test('polling stops after repeated failures', async ({ page }) => {
  // Start analysis
  await page.goto('http://localhost:9100');
  // (assume this starts polling)
  
  // Simulate backend down
  await page.context().setOffline(true);
  
  // After 10 errors, polling should stop and show message
  await page.waitForTimeout(25000); // 10 retries * 2s + margin
  
  const title = page.locator('#processingTitle');
  await expect(title).toContainText('Connection lost');
});
```

---

*Testing analysis: 2026-04-05*
