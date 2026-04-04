"""Generate actionable UX recommendations using Claude API."""

import logging

from app.config import settings
from app.models.brain_regions import UX_METRIC_LABELS
from app.services.brain_mapper import interpret_z_score

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a senior UX analyst interpreting neural response data from Meta's TRIBE v2 brain encoding model. You translate cortical activation patterns into specific, actionable design recommendations.

You receive z-scored neural metrics comparing a design against established baselines:
- z < -1.5: Significantly LOW activation (under-stimulation)
- -1.5 to -0.5: Below average
- -0.5 to 0.5: Normal range
- 0.5 to 1.5: Above average (mild concern)
- 1.5 to 2.5: Elevated (likely UX issue)
- z > 2.5: Extreme (critical UX problem)

Key interpretive rules:
1. HIGH cognitive load (z > 1) = the design is hard to process. Recommend simplification.
2. HIGH attention/salience (z > 1) = competing visual elements. Recommend focal point hierarchy.
3. LOW visual processing (z < -1) = the design is visually unstimulating. Recommend more contrast/imagery.
4. HIGH reading/language (z > 1) = text-heavy or hard to scan. Recommend shorter copy, better typography.
5. LOW emotional response (z < -1) = the design feels clinical/cold. Recommend warmer colors, imagery.

Be specific, reference actual metric values, and provide concrete fixes (not vague advice like "improve the layout"). Each recommendation should name a specific element or area to change and how."""


def generate_analysis(
    media_type: str,
    metrics: dict,
    z_scores: dict,
    temporal_hotspots: list,
    duration: float,
    image_path: str | None = None,
) -> tuple[str, float]:
    """
    Call Claude API to generate UX analysis from neural metrics.

    Falls back to mock analysis when no API key is configured.

    Returns:
        analysis: str — formatted analysis text
        friction_score: float — 1-10 friction rating
    """
    metrics_section = _format_metrics(z_scores)
    hotspots_section = _format_hotspots(temporal_hotspots)

    user_prompt = f"""## Stimulus
Type: {media_type}
Duration: {duration:.1f} seconds

## Neural Response Metrics (z-scores relative to baseline)
{metrics_section}

## Temporal Hotspots (peak activation moments)
{hotspots_section}

## Your Task
1. **Summary** (2-3 sentences): What do these neural patterns reveal about the user experience?
2. **Top 3 Issues**: Identify the most significant UX problems indicated by the data. For each, explain the neural evidence and the likely user experience impact.
3. **5 Recommendations** (ranked by predicted impact): Specific, actionable design changes. Each should reference the metric it addresses and include a concrete implementation suggestion.
4. **Friction Score**: Rate overall UX friction on a 1-10 scale (1=frictionless, 10=extremely frustrating).

Format your friction score on its own line as: FRICTION_SCORE: X"""

    if not settings.anthropic_api_key:
        logger.info("No API key configured — using mock analysis")
        return _mock_analysis(z_scores, temporal_hotspots), _estimate_friction(z_scores)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

        messages_content = []

        # If image is available and multimodal is desired, include it
        if image_path:
            import base64

            with open(image_path, "rb") as f:
                image_data = base64.standard_b64encode(f.read()).decode("utf-8")
            messages_content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": image_data,
                },
            })

        messages_content.append({"type": "text", "text": user_prompt})

        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": messages_content}],
        )

        analysis_text = message.content[0].text
        friction_score = _extract_friction_score(analysis_text)

        return analysis_text, friction_score

    except Exception as e:
        logger.error(f"Claude API error: {e}")
        return _mock_analysis(z_scores, temporal_hotspots), _estimate_friction(z_scores)


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
    cog = abs(z_scores.get("cognitive_load", 0))
    att = abs(z_scores.get("attention_salience", 0))
    avg_z = sum(abs(v) for v in z_scores.values()) / max(len(z_scores), 1)
    score = min(10, max(1, 3 + cog * 1.5 + att * 1.0 + avg_z * 0.5))
    return round(score, 1)


def _mock_analysis(z_scores: dict, hotspots: list) -> str:
    """Generate context-aware placeholder analysis when no API key is configured."""
    # Build dynamic analysis based on actual z-scores
    issues = []
    recs = []

    cog_z = z_scores.get("cognitive_load", 0)
    att_z = z_scores.get("attention_salience", 0)
    vis_z = z_scores.get("visual_processing", 0)
    read_z = z_scores.get("reading_language", 0)
    emo_z = z_scores.get("emotional_response", 0)
    obj_z = z_scores.get("object_recognition", 0)

    # Generate issues based on z-scores
    if cog_z > 0.5:
        issues.append(
            f"**Elevated Cognitive Load** (z={cog_z:+.2f}): The dorsolateral prefrontal "
            f"cortex shows above-baseline activation, indicating the design requires "
            f"excessive working memory. This typically results from competing calls-to-action "
            f"or unclear visual hierarchy."
        )
        recs.append(
            "**Reduce cognitive load**: Limit to one primary CTA per viewport. "
            "Group related information into clearly separated sections with "
            "consistent heading hierarchy."
        )
    elif cog_z < -0.5:
        issues.append(
            f"**Low Cognitive Engagement** (z={cog_z:+.2f}): Prefrontal activation is "
            f"below baseline, suggesting the design may be too simple to engage users "
            f"meaningfully."
        )

    if att_z > 0.5:
        issues.append(
            f"**High Attention Demand** (z={att_z:+.2f}): The attention/salience networks "
            f"show elevated activation, indicating multiple elements compete for visual "
            f"priority without a clear focal point."
        )
        recs.append(
            "**Establish visual focal point**: Make the primary element at least 2x larger "
            "than secondary elements. Use whitespace to create breathing room between "
            "content sections."
        )

    if read_z > 0.5:
        issues.append(
            f"**Reading Strain** (z={read_z:+.2f}): Language processing regions show "
            f"above-normal activation, indicating dense text blocks or poor typography."
        )
        recs.append(
            "**Simplify text**: Break paragraphs into scannable bullet points. "
            "Increase line-height to 1.5-1.6 and limit line length to 65-75 characters."
        )

    if vis_z < -0.5:
        recs.append(
            "**Enhance visual interest**: Add high-quality imagery or illustrations. "
            "Increase color contrast between foreground elements and background."
        )

    if emo_z < -0.5:
        recs.append(
            "**Add emotional warmth**: Incorporate human imagery, warmer color accents, "
            "or micro-interactions to create a more engaging emotional tone."
        )

    # Ensure at least 3 issues
    if len(issues) < 3:
        if obj_z > 0.3:
            issues.append(
                f"**Object Recognition Load** (z={obj_z:+.2f}): Visual object recognition "
                f"areas show moderate activation, suggesting many distinct visual elements "
                f"that the brain must individually process."
            )
        if len(issues) < 3:
            issues.append(
                "**Temporal Attention Spikes**: Peak attention occurs in multiple page "
                "sections, indicating the design lacks a clear reading flow from top to bottom."
            )
        if len(issues) < 3:
            issues.append(
                "**Visual Processing Pattern**: The occipital cortex activation suggests "
                "moderate visual complexity that could be streamlined."
            )

    # Ensure at least 5 recommendations
    while len(recs) < 5:
        filler_recs = [
            "**Strengthen visual hierarchy**: Use size contrast — primary elements should "
            "be at least 2x larger than secondary ones.",
            "**Reduce color palette**: Limit to 2-3 primary colors to lower attention "
            "network activation and create visual calm.",
            "**Add progressive disclosure**: Hide secondary information behind expandable "
            "sections to reduce initial cognitive load.",
            "**Improve whitespace**: Increase padding between sections by 20-30% to give "
            "the visual cortex natural rest points.",
            "**Optimize typography**: Use a clear type scale (1.25 ratio) with distinct "
            "weights for headings vs body text.",
        ]
        for r in filler_recs:
            if r not in recs:
                recs.append(r)
                if len(recs) >= 5:
                    break

    friction = _estimate_friction(z_scores)

    # Compose final analysis
    summary = (
        f"The neural response patterns indicate "
        f"{'significant' if friction > 6 else 'moderate' if friction > 4 else 'mild'} "
        f"cognitive friction in this design. "
        f"{'Cognitive load and attention networks show elevated activation, ' if cog_z > 0.5 or att_z > 0.5 else ''}"
        f"suggesting {'competing visual elements that force harder processing' if att_z > 0.5 else 'room for optimization in visual hierarchy'}."
    )

    issues_text = "\n\n".join(f"{i+1}. {issue}" for i, issue in enumerate(issues[:3]))
    recs_text = "\n".join(f"{i+1}. {rec}" for i, rec in enumerate(recs[:5]))

    return f"""## Summary
{summary}

## Top 3 UX Issues

{issues_text}

## Recommendations (ranked by impact)

{recs_text}

FRICTION_SCORE: {friction}"""
