# Claude API Prompt Iterations

## v1 — Initial prompt (skeleton phase)
Basic system prompt asking Claude to interpret z-scores and give recommendations.
- Issue: Recommendations were generic ("improve the layout", "reduce clutter")
- Issue: No clear structure in output made parsing unreliable

## v2 — Structured output format (milestone 3)
Added explicit output sections (Summary, Top 3 Issues, 5 Recommendations, Friction Score).
- Added `FRICTION_SCORE: X` format for reliable parsing
- Added specific z-score interpretation ranges in system prompt
- Added "key interpretive rules" mapping metric directions to UX implications
- Improvement: Output now follows consistent structure
- Improvement: Recommendations reference actual metric values

## v3 — Multimodal-ready (milestone 4)
Added image input support alongside metrics.
- System prompt updated to instruct Claude to reference specific visual elements
- Added `image_path` parameter to `generate_analysis()`
- Base64 image encoding sent as vision input when available
- Improvement: Recommendations reference actual visible elements ("the red CTA in the top right")

## Mock Analysis Improvements
The mock analysis (used when no API key is set) was also improved:
- v1: Static placeholder text regardless of actual metrics
- v2: Dynamic analysis that varies based on actual z-score values
- v2 generates contextually appropriate issues and recommendations based on which metrics are elevated/depressed
