"""Generate actionable UX recommendations using Claude API."""

import anthropic

from app.config import settings
from app.models.brain_regions import UX_METRIC_LABELS
from app.services.brain_mapper import interpret_z_score


SYSTEM_PROMPT = """You are a UX analyst interpreting neural response data from a brain encoding model (Meta's TRIBE v2). You translate brain activation patterns into actionable design recommendations.

You receive z-scored neural metrics that compare a user's media against established baselines:
- z < -1: Unusually LOW activation
- -1 to 1: Normal range
- z > 1: Elevated (potential issue)
- z > 2: Extreme (likely problem)

Be specific, data-driven, and actionable. Reference the actual metric values in your analysis."""


def generate_analysis(
    media_type: str,
    metrics: dict,
    z_scores: dict,
    temporal_hotspots: list,
    duration: float,
) -> tuple[str, float]:
    """
    Call Claude API to generate UX analysis from neural metrics.

    Returns:
        analysis: str — formatted analysis text
        friction_score: float — 1-10 friction rating
    """
    # Build the prompt
    metrics_section = _format_metrics(z_scores)
    hotspots_section = _format_hotspots(temporal_hotspots)

    user_prompt = f"""## Stimulus
Type: {media_type}
Duration: {duration:.1f} seconds

## Neural Response Metrics (z-scores relative to baseline)
{metrics_section}

## Temporal Hotspots
{hotspots_section}

## Task
1. Summarize what these neural patterns suggest about the user experience in 2-3 sentences.
2. Identify the top 3 UX issues indicated by the data, each with a brief explanation.
3. Provide 5 specific, actionable design recommendations ranked by predicted impact.
4. Rate overall UX friction on a 1-10 scale (1=frictionless, 10=extremely frustrating) with a one-sentence justification.

Format your friction score on its own line as: FRICTION_SCORE: X"""

    if not settings.anthropic_api_key:
        return _mock_analysis(z_scores, temporal_hotspots), _estimate_friction(z_scores)

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    analysis_text = message.content[0].text

    # Extract friction score from response
    friction_score = _extract_friction_score(analysis_text)

    return analysis_text, friction_score


def _format_metrics(z_scores: dict) -> str:
    lines = []
    for key, z in z_scores.items():
        label = UX_METRIC_LABELS.get(key, key)
        interp = interpret_z_score(z)
        lines.append(f"- {label}: z={z:+.2f} ({interp})")
    return "\n".join(lines)


def _format_hotspots(hotspots: list) -> str:
    lines = []
    for h in hotspots:
        label = UX_METRIC_LABELS.get(h["metric"], h["metric"])
        lines.append(
            f"- Peak {label} at t={h['timestamp']:.1f}s "
            f"(page section: {h['section']}, value: {h['value']:.3f})"
        )
    return "\n".join(lines)


def _extract_friction_score(text: str) -> float:
    for line in text.split("\n"):
        if "FRICTION_SCORE:" in line.upper():
            try:
                score_str = line.split(":")[-1].strip().split("/")[0].strip()
                return float(score_str)
            except (ValueError, IndexError):
                pass
    return 5.0  # Default if parsing fails


def _estimate_friction(z_scores: dict) -> float:
    """Estimate friction score from z-scores when no LLM is available."""
    # Higher absolute z-scores in cognitive load and attention = more friction
    cog = abs(z_scores.get("cognitive_load", 0))
    att = abs(z_scores.get("attention_salience", 0))
    avg_z = sum(abs(v) for v in z_scores.values()) / len(z_scores)
    score = min(10, max(1, 3 + cog * 1.5 + att * 1.0 + avg_z * 0.5))
    return round(score, 1)


def _mock_analysis(z_scores: dict, hotspots: list) -> str:
    """Generate a placeholder analysis when no API key is configured."""
    return """## Summary
The neural response patterns indicate moderate cognitive friction in this design. Visual processing activation is within normal range, but attention demand and cognitive load show elevated levels, suggesting competing visual elements that force the viewer to work harder to process the content.

## Top 3 UX Issues

**1. Elevated Cognitive Load**
The dorsolateral prefrontal cortex shows above-baseline activation, indicating the design requires excessive working memory to parse. This typically results from too many competing calls-to-action or unclear visual hierarchy.

**2. High Attention Demand**
The attention/salience networks show elevated activation, particularly in the middle section of the page. This suggests multiple elements are competing for visual priority without a clear focal point.

**3. Language Processing Strain**
Reading-related brain regions show above-normal activation, which may indicate dense text blocks, poor typography choices, or insufficient whitespace between text elements.

## Recommendations (ranked by impact)

1. **Establish a single, clear visual focal point** — reduce the number of competing CTAs to one primary action per viewport.
2. **Increase whitespace** between content sections to give the visual cortex natural "rest points" and reduce attention competition.
3. **Simplify text blocks** — break long paragraphs into scannable bullet points or use progressive disclosure.
4. **Strengthen visual hierarchy** with size contrast — make the most important element at least 2x larger than secondary elements.
5. **Reduce color palette** to 2-3 primary colors to lower the attention network's activation and create a calmer visual experience.

FRICTION_SCORE: 6.5"""
