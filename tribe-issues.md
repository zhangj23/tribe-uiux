# TRIBE UX Analyzer — Issue Tracker

> Single source of truth for UI/UX issues found during evaluation loops.

## Round 1

### issue-001 — `merged` — HIGH
```
ISSUE: --text-dim fails WCAG AA contrast (ratio ~2.2:1, needs 4.5:1)
AGENT: A, B
FILE: frontend/css/main.css (line 34)
SEVERITY: high
DESCRIPTION: --text-dim (#4a4f62) has contrast ratio of ~2.2-2.5 against all dark backgrounds. Used for header subtitle, format tags, slider labels, stage numbers, progress meta, brain legend. Lighthouse accessibility scored 89 due to this. WCAG AA requires 4.5:1 for normal text.
REPRODUCTION: upload-desktop-r1.png — subtitle and format tags are barely legible. Lighthouse color-contrast audit: 5+ elements failed.
SUGGESTION: Change --text-dim from #4a4f62 to #6b7190 (~4.5:1 contrast against --bg-deep).
```

### issue-002 — `merged` — HIGH
```
ISSUE: No :focus-visible styles for any interactive elements
AGENT: A
FILE: frontend/css/main.css, frontend/css/components.css
SEVERITY: high
DESCRIPTION: No interactive element has :focus-visible styling. Keyboard users cannot see which element is focused. Zero instances of :focus, :focus-visible, or outline on buttons/links.
REPRODUCTION: Tab through the page — no focus indicator visible anywhere.
SUGGESTION: Add global `:focus-visible { outline: 2px solid var(--phosphor); outline-offset: 2px; }` to main.css.
```

### issue-003 — `merged` — HIGH
```
ISSUE: Chart.js loaded as render-blocking script in <head>
AGENT: B
FILE: frontend/index.html (line 12)
SEVERITY: high
DESCRIPTION: Chart.js (72 KB) is synchronous in <head>, blocking initial render by ~2.6s per Lighthouse. 89% of bytes unused on page load. Only needed in results view.
REPRODUCTION: Lighthouse render-blocking-resources: wastedMs: 2594.
SUGGESTION: Add `defer` attribute, or lazy-load dynamically in charts.js when first needed.
```

### issue-004 — `merged` — HIGH
```
ISSUE: All local JS files are render-blocking (no defer)
AGENT: B
FILE: frontend/index.html (lines 204-209)
SEVERITY: high
DESCRIPTION: Six local scripts loaded without defer. Lighthouse reports ~955ms wasted. All scripts use DOMContentLoaded so defer is safe.
REPRODUCTION: Lighthouse render-blocking-resources audit.
SUGGESTION: Add `defer` to all <script> tags in index.html.
```

### issue-005 — `merged` — MEDIUM
```
ISSUE: Upload icon arrow points downward (download, not upload)
AGENT: A
FILE: frontend/index.html (lines 63-64)
SEVERITY: medium
DESCRIPTION: The dropzone SVG arrow points down (Y=4 to Y=32), universally signifying "download" not "upload."
REPRODUCTION: upload-desktop-r1.png — arrow inside dropzone points down.
SUGGESTION: Change path to `M24 36L24 8` (shaft) and `M16 16L24 8L32 16` (chevron) to point upward.
```

### issue-006 — `merged` — MEDIUM
```
ISSUE: --dim border color is nearly invisible (contrast ~1.4:1)
AGENT: A
FILE: frontend/css/main.css (line 35)
SEVERITY: medium
DESCRIPTION: --dim (#2a2f3e) used for borders, dropzone, progress tracks is barely visible against backgrounds. Contrast ratio ~1.44:1.
REPRODUCTION: upload-desktop-r1.png — dropzone dashed border almost invisible.
SUGGESTION: Increase --dim to #363b4f for ~3:1 contrast.
```

### issue-007 — `merged` — MEDIUM
```
ISSUE: Range slider missing Firefox (::-moz-*) styling
AGENT: A
FILE: frontend/css/main.css (lines 661-669)
SEVERITY: medium
DESCRIPTION: Only -webkit-slider-thumb styled. Firefox shows default blue rectangle thumb.
REPRODUCTION: Code inspection — no ::-moz-range-thumb or ::-moz-range-track rules.
SUGGESTION: Add matching ::-moz-range-thumb and ::-moz-range-track rules.
```

### issue-008 — `merged` — MEDIUM
```
ISSUE: Results grid jumps from 3 columns to 1 at 1200px (no intermediate breakpoint)
AGENT: A
FILE: frontend/css/main.css (lines 579-585, 798-808)
SEVERITY: medium
DESCRIPTION: Grid uses fixed 320px + 1fr + 380px. At 1200px snaps directly to single column. No tablet landscape layout.
REPRODUCTION: Code inspection — no breakpoint between 768px and 1200px.
SUGGESTION: Add @media (max-width: 1024px) with 2-column layout. Use minmax() instead of fixed pixel widths.
```

### issue-009 — `merged` — MEDIUM
```
ISSUE: Google Fonts stylesheet is render-blocking (888ms wasted)
AGENT: B
FILE: frontend/index.html (line 9)
SEVERITY: medium
DESCRIPTION: Google Fonts CSS link blocks rendering. Fallback font stacks already defined in CSS variables.
REPRODUCTION: Lighthouse render-blocking-resources: wastedMs: 888.
SUGGESTION: Add `media="print" onload="this.media='all'"` to the Google Fonts <link> with a <noscript> fallback.
```

### issue-010 — `merged` — MEDIUM
```
ISSUE: No GZip compression on static assets (34 KiB savings)
AGENT: B
FILE: backend/app/main.py
SEVERITY: medium
DESCRIPTION: FastAPI serves all assets uncompressed. Lighthouse reports 34 KiB savings from text compression.
REPRODUCTION: Lighthouse uses-text-compression: score 0.5.
SUGGESTION: Add `from starlette.middleware.gzip import GZipMiddleware; app.add_middleware(GZipMiddleware, minimum_size=500)` to main.py.
```

### issue-011 — `merged` — MEDIUM
```
ISSUE: No client-side file type validation before upload
AGENT: C
FILE: frontend/js/upload.js (selectFile, line 64)
SEVERITY: medium
DESCRIPTION: Drag-and-drop bypasses HTML accept attribute. Any file type accepted, only rejected by backend with raw alert() error.
REPRODUCTION: Drag .txt file onto dropzone, click "Begin Analysis" — browser alert with backend error.
SUGGESTION: Add extension whitelist check in selectFile() and drop handler. Show inline error instead of allowing selection.
```

### issue-012 — `merged` — MEDIUM
```
ISSUE: Processing view not reset when starting new analysis
AGENT: C
FILE: frontend/js/app.js (showUpload, line 32), frontend/js/polling.js
SEVERITY: medium
DESCRIPTION: Progress bar, percentage, title, stage indicators retain values from previous analysis. Starting new analysis briefly shows stale "100% / Analysis complete."
REPRODUCTION: Complete analysis, click "New Analysis", start second analysis — processing view shows stale state.
SUGGESTION: Add resetProcessingUI() that zeros progress bar, sets title to "Initializing...", clears stage classes. Call from showUpload() or start of startProcessing().
```

### issue-013 — `merged` — MEDIUM
```
ISSUE: No cancel/back button during processing
AGENT: C
FILE: frontend/index.html (viewProcessing section)
SEVERITY: medium
DESCRIPTION: Processing view has zero buttons. User is trapped until analysis completes or fails. No way to cancel or go back.
REPRODUCTION: Start analysis — no interactive controls in processing view.
SUGGESTION: Add "Cancel" button that calls Polling.stop(), BrainView.stopProcessingAnimation(), App.showUpload().
```

### issue-014 — `merged` — MEDIUM
```
ISSUE: Analyze button not disabled during upload (double-submit possible)
AGENT: C
FILE: frontend/js/upload.js (uploadFile, line 94)
SEVERITY: medium
DESCRIPTION: "Begin Analysis" button remains clickable during upload request. Rapid clicks create duplicate jobs.
REPRODUCTION: Click "Begin Analysis" twice rapidly — two POST /api/upload requests sent.
SUGGESTION: Disable button and change text to "Uploading..." at start of uploadFile(). Re-enable in catch block.
```

### issue-015 — `merged` — MEDIUM
```
ISSUE: Timestep slider event listener accumulates on repeated analyses
AGENT: C
FILE: frontend/js/results.js (setupTimestepSlider, line 99)
SEVERITY: medium
DESCRIPTION: Each Results.render() call adds a new 'input' event listener without removing previous ones. Memory leak over repeated analyses.
REPRODUCTION: Run two analyses — slider has two identical listeners.
SUGGESTION: Store handler reference in module variable, removeEventListener before adding new one.
```

### issue-016 — `merged` — LOW
```
ISSUE: Header subtitle crowds on narrow viewports (375px)
AGENT: A
FILE: frontend/css/main.css (lines 810-818)
SEVERITY: low
DESCRIPTION: At 640px breakpoint, header subtitle and status indicator crowd together. Tight fit on mobile.
SUGGESTION: At 640px breakpoint, add `.header-subtitle { display: none; }`.
```

### issue-017 — `merged` — LOW
```
ISSUE: Dropzone tray icon uses --dim (invisible)
AGENT: A
FILE: frontend/index.html (line 65)
SEVERITY: low
DESCRIPTION: The upload icon's tray/container path uses --dim (nearly invisible). Only the arrow shaft is visible.
SUGGESTION: Change `stroke="var(--dim)"` to `stroke="var(--text-secondary)"`.
```

### issue-018 — `merged` — LOW
```
ISSUE: BrainView.init() runs on page load even though only needed in results
AGENT: B
FILE: frontend/js/brain-view.js, frontend/js/app.js (line 13)
SEVERITY: low
DESCRIPTION: generateBrainLayout() (1024-point rejection sampling) runs on every page load. Wasted computation on upload view.
SUGGESTION: Defer BrainView.init() to first Results.render() call with a guard flag.
```

### issue-019 — `merged` — LOW
```
ISSUE: No URL history management (browser back navigates away)
AGENT: C
FILE: frontend/js/app.js
SEVERITY: low
DESCRIPTION: View switching doesn't update URL or browser history. Back button leaves the app entirely.
SUGGESTION: Use pushState/popState to track view transitions. Handle popstate to return to appropriate view.
```

### issue-020 — `merged` — LOW
```
ISSUE: Polling continues silently on network errors
AGENT: C
FILE: frontend/js/polling.js (poll function)
SEVERITY: low
DESCRIPTION: Poll errors only logged to console. No retry limit, no user-visible error state. Polls forever if server dies.
SUGGESTION: Add error counter. After 5 failures show "Connection lost" message. After 10+ stop polling and show retry button.
```

### issue-021 — `merged` — LOW
```
ISSUE: Upload error shown via browser alert() instead of inline UI
AGENT: C
FILE: frontend/js/upload.js (uploadFile, line 112)
SEVERITY: low
DESCRIPTION: Upload failures shown via alert(). Jarring, unstyled, and invalid file remains selected after dismissal.
SUGGESTION: Replace alert() with inline error element near dropzone. Call clearFile() after failed upload.
```

### issue-022 — `merged` — LOW
```
ISSUE: Results grid has no max-width (stretches on ultra-wide monitors)
AGENT: A
FILE: frontend/css/main.css (lines 579-585)
SEVERITY: low
DESCRIPTION: Results grid has no max-width. On 2560px+ monitors, center panel becomes disproportionately wide.
SUGGESTION: Add `max-width: 1600px; margin: 0 auto;` to .results-grid.
```

### issue-023 — `merged` — LOW
```
ISSUE: No file size limit on client or server
AGENT: C
FILE: frontend/js/upload.js, backend/app/routers/upload.py
SEVERITY: low
DESCRIPTION: No maximum file size enforced. User could upload multi-GB files.
SUGGESTION: Client-side: reject files > 100MB in selectFile(). Server-side: add size check in upload endpoint.
```

## Round 2

### issue-024 — `merged` — HIGH
```
ISSUE: Analyze button stays disabled after successful upload (second analysis impossible)
AGENT: C
FILE: frontend/js/upload.js
SEVERITY: high
DESCRIPTION: uploadFile() disables the button but only re-enables in catch block. On success, view switches away but button stays disabled. clearFile() doesn't reset it. Second analysis impossible without page reload.
REPRODUCTION: Upload -> analyze -> complete -> "New Analysis" -> upload file -> button still disabled.
SUGGESTION: In clearFile(), re-enable the button and restore text to "Begin Analysis".
```

### issue-025 — `merged` — HIGH
```
ISSUE: --text-dim still fails WCAG AA on small text (4.01:1 vs 4.5:1)
AGENT: A
FILE: frontend/css/main.css (line 34)
SEVERITY: high
DESCRIPTION: --text-dim (#6b7190) on --bg (#0d0f14) yields 4.01:1. Format tags and status text (0.6-0.7rem) need 4.5:1 for WCAG AA.
REPRODUCTION: Lighthouse color-contrast: 8 elements failing.
SUGGESTION: Increase --text-dim to #7d839c (~4.8:1) or use --text-secondary for small text.
```

### issue-026 — `merged` — HIGH
```
ISSUE: Media query ordering bug — 2-column tablet breakpoint overridden by 1-column
AGENT: A
FILE: frontend/css/main.css
SEVERITY: high
DESCRIPTION: @media (max-width: 1024px) rule is before @media (max-width: 1200px). At <1024px both match, later 1200px rule wins. 2-column layout never renders.
REPRODUCTION: Tablet screenshot shows single-column.
SUGGESTION: Swap order: 1200px breakpoint first, then 1024px. Or use min-width range queries.
```

### issue-027 — `merged` — MEDIUM
```
ISSUE: popstate handler only handles 'upload' — back from results broken
AGENT: C
FILE: frontend/js/app.js
SEVERITY: medium
DESCRIPTION: popstate only checks for 'upload' view. Back from #results leaves view stuck. pushState creates stale #processing entry.
SUGGESTION: Handle all view states in popstate. Use replaceState for processing view.
```

### issue-028 — `merged` — MEDIUM
```
ISSUE: LLM analysis innerHTML without HTML entity escaping (XSS vector)
AGENT: C
FILE: frontend/js/results.js (renderAnalysis)
SEVERITY: medium
DESCRIPTION: LLM text set via innerHTML with no escaping. If LLM outputs HTML tags, they execute in DOM.
SUGGESTION: Escape &, <, > before regex markdown conversion.
```

### issue-029 — `merged` — MEDIUM
```
ISSUE: CSS stylesheets still render-blocking (952ms wasted)
AGENT: B
FILE: frontend/index.html (lines 11-12)
SEVERITY: medium
DESCRIPTION: main.css and components.css are render-blocking. 83% of LCP is render delay.
SUGGESTION: Inline critical above-the-fold CSS in <style> tag, async-load full stylesheets.
```

### issue-030 — `merged` — LOW
```
ISSUE: Missing favicon causes 404 console error
AGENT: B
FILE: frontend/index.html
SEVERITY: low
DESCRIPTION: No favicon. Browser requests /favicon.ico and gets 404. Lighthouse flags console error.
SUGGESTION: Add inline SVG favicon in <head>.
```

## Round 4 (Post-Milestone Evaluation)

### issue-031 — `merged` — MEDIUM
```
ISSUE: Compare flow has no file type/size validation for Design B
AGENT: C
FILE: frontend/js/compare.js
SEVERITY: medium
DESCRIPTION: selectFileB() accepts any file without checking extension or size.
SUGGESTION: Add ALLOWED_EXTENSIONS and MAX_FILE_SIZE checks matching upload.js.
```

### issue-032 — `merged` — LOW
```
ISSUE: Compare error handler uses alert() instead of inline error UI
AGENT: C
FILE: frontend/js/compare.js
SEVERITY: low
DESCRIPTION: runComparison() catch block calls alert() instead of inline error banner.
SUGGESTION: Add error-banner div and use showCompareError() pattern.
```

### issue-033 — `merged` — MEDIUM
```
ISSUE: Compare dual polling has no error limit — polls forever on network failure
AGENT: C
FILE: frontend/js/compare.js
SEVERITY: medium
DESCRIPTION: Dual polling silently retries forever with no error counter or user feedback.
SUGGESTION: Add consecutive error counters, stop after 10 failures.
```

### issue-034 — `merged` — MEDIUM
```
ISSUE: Cancel button does not stop compare polling
AGENT: C
FILE: frontend/js/app.js, frontend/js/compare.js
SEVERITY: medium
DESCRIPTION: Cancel button calls Polling.stop() but not Compare.stopPolling().
SUGGESTION: Wire cancel handler to also call Compare.stopPolling().
```

### issue-035 — `merged` — LOW
```
ISSUE: Compare processing view does not reset UI before starting
AGENT: C
FILE: frontend/js/compare.js
SEVERITY: low
DESCRIPTION: Compare doesn't call resetProcessingUI() so stale progress shows.
SUGGESTION: Call Polling.resetProcessingUI() before switching to processing view.
```

### issue-036 — `merged` — LOW
```
ISSUE: Compare runCompareBtn stays disabled after successful comparison
AGENT: C
FILE: frontend/js/compare.js
SEVERITY: low
DESCRIPTION: Button state not restored in reset(), stays disabled after comparison.
SUGGESTION: Reset button text and disabled state in Compare.reset().
```

### issue-037 — `merged` — MEDIUM
```
ISSUE: Upload filename used directly in save path (path traversal risk)
AGENT: C
FILE: backend/app/routers/upload.py, backend/app/routers/compare.py
SEVERITY: medium
DESCRIPTION: file.filename used directly in Path, allowing path traversal.
SUGGESTION: Sanitize with re.sub and use only base name.
```

### issue-038 — `merged` — LOW
```
ISSUE: In-memory job store grows without bound (no cleanup)
AGENT: C
FILE: backend/app/services/job_manager.py
SEVERITY: low
DESCRIPTION: _jobs dict never pruned, grows indefinitely consuming memory.
SUGGESTION: Add TTL-based cleanup on create_job(), cap at 100 jobs.
```

### issue-039 — `merged` — HIGH
```
ISSUE: Chart.js axis labels use stale #4a4f62 color (fails WCAG AA)
AGENT: A
FILE: frontend/js/charts.js
SEVERITY: high
DESCRIPTION: Chart axis ticks hardcoded to pre-fix --text-dim value. Contrast ~2.2:1.
SUGGESTION: Replace all #4a4f62 with #7d839c in charts.js.
```

### issue-040 — `merged` — LOW
```
ISSUE: Chart.js tooltip borderColor uses stale #2a2f3e
AGENT: A
FILE: frontend/js/charts.js
SEVERITY: low
DESCRIPTION: Tooltip border uses old --dim value, nearly invisible.
SUGGESTION: Change to #363b4f (current --dim).
```

### issue-041 — `merged` — MEDIUM
```
ISSUE: .btn-analyze has no :disabled styles
AGENT: A
FILE: frontend/css/main.css
SEVERITY: medium
DESCRIPTION: Primary button looks active when disabled. No visual feedback.
SUGGESTION: Add .btn-analyze:disabled with opacity, cursor, no shadow.
```

### issue-042 — `merged` — LOW
```
ISSUE: Two chart colors outside design system palette
AGENT: A
FILE: frontend/js/charts.js, frontend/css/main.css
SEVERITY: low
DESCRIPTION: #7c6aff and #ff85c8 not defined as CSS variables.
SUGGESTION: Add --purple and --pink to :root.
```

### issue-043 — `merged` — LOW
```
ISSUE: View opacity transition never animates (dead CSS)
AGENT: A
FILE: frontend/css/main.css
SEVERITY: low
DESCRIPTION: opacity transition on display:none never fires; view-enter animation handles it.
SUGGESTION: Remove dead opacity/transition from .view.
```

### issue-044 — `merged` — MEDIUM
```
ISSUE: No Cache-Control headers on static assets
AGENT: B
FILE: backend/app/main.py
SEVERITY: medium
DESCRIPTION: All CSS/JS served with no cache headers. Browser re-downloads every load.
SUGGESTION: Add Cache-Control middleware for /css/ and /js/ paths.
```

### issue-045 — `merged` — MEDIUM
```
ISSUE: Chart.js fully loaded on upload page (62KB unused)
AGENT: B
FILE: frontend/index.html, frontend/js/charts.js
SEVERITY: medium
DESCRIPTION: Chart.js downloaded and parsed on every page load even though only used in results.
SUGGESTION: Lazy-load Chart.js dynamically on first renderTimeseries call.
```

### issue-046 — `merged` — LOW
```
ISSUE: Missing meta description (SEO)
AGENT: B
FILE: frontend/index.html
SEVERITY: low
DESCRIPTION: No meta description tag. Lighthouse SEO score 0.9.
SUGGESTION: Add meta description in head.
```
