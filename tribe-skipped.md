# TRIBE UX Analyzer — Skipped Flows

> Flows that require a live LLM API key and were skipped during evaluation.

## Round 1

1. **Real Claude API analysis response** — The LLM interpreter returns hardcoded mock text when no API key is set. Cannot test: response parsing, varied recommendation quality, FRICTION_SCORE extraction from real LLM output, error handling for API timeouts/rate limits.

2. **LLM analysis text rendering variety** — Mock analysis returns identical text for every upload. Cannot evaluate: how the results panel handles varying-length responses, different markdown structures, edge cases in the markdown renderer.

3. **End-to-end with real TRIBE v2 + LLM** — Full pipeline with real neural inference + real LLM cannot be tested. The mock data exercises the same UI code paths but real data may expose rendering edge cases (e.g., extreme z-score values, very long timeseries).
