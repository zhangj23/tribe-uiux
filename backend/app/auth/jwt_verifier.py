"""Verify Supabase-issued JWTs.

Supabase signs access tokens using the project's JWKS keys. Modern projects
use ES256 (ECDSA P-256); older ones may use HS256. We fetch the public key from
Supabase's JWKS endpoint on first use and cache it for the process lifetime.
"""

from __future__ import annotations

import base64
import json
import logging
from typing import Any

from jose import jwk, jwt
from jose.exceptions import ExpiredSignatureError, JWTClaimsError, JWTError

from app.config import settings

logger = logging.getLogger(__name__)


class InvalidTokenError(Exception):
    """Raised when a JWT fails verification."""


# Cached JWKS keys fetched from Supabase
_jwks_keys: list[dict] | None = None


def _peek_header(token: str) -> dict | None:
    """Decode the JWT header WITHOUT verifying, for diagnostics."""
    try:
        header_b64 = token.split(".")[0]
        header_b64 += "=" * (4 - len(header_b64) % 4)
        return json.loads(base64.urlsafe_b64decode(header_b64))
    except Exception:
        return None


def _fetch_jwks() -> list[dict]:
    """Fetch JWKS from Supabase's well-known endpoint. Cached after first call."""
    global _jwks_keys
    if _jwks_keys is not None:
        return _jwks_keys

    if not settings.supabase_url:
        return []

    import httpx
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    try:
        resp = httpx.get(url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        _jwks_keys = data.get("keys", [])
        logger.info("Fetched %d JWKS key(s) from Supabase", len(_jwks_keys))
        return _jwks_keys
    except Exception as exc:
        logger.warning("Failed to fetch JWKS from %s: %s", url, exc)
        return []


def _candidate_hmac_secrets(raw: str) -> list[str | bytes]:
    """Return candidate HMAC secrets: raw string first, then base64-decoded bytes."""
    candidates: list[str | bytes] = [raw]
    try:
        decoded = base64.b64decode(raw)
        if decoded != raw.encode():
            candidates.append(decoded)
    except Exception:
        pass
    return candidates


def verify_supabase_jwt(token: str) -> dict[str, Any]:
    """Decode + verify a Supabase access token.

    Returns the payload dict on success (contains `sub`, `email`, `aud`, etc.).
    Raises InvalidTokenError on any failure.
    """
    if not settings.supabase_jwt_secret and not settings.supabase_url:
        raise InvalidTokenError(
            "Neither SUPABASE_JWT_SECRET nor SUPABASE_URL is configured"
        )

    if not token:
        raise InvalidTokenError("Missing token")

    header = _peek_header(token)
    alg = header.get("alg", "HS256") if header else "HS256"
    kid = header.get("kid") if header else None

    last_error: Exception | None = None

    # --- Asymmetric (ES256, RS256, etc.) via JWKS ---
    if alg not in ("HS256", "HS384", "HS512"):
        keys = _fetch_jwks()
        for key_data in keys:
            # Match by kid if present, otherwise try all keys
            if kid and key_data.get("kid") != kid:
                continue
            try:
                public_key = jwk.construct(key_data, algorithm=alg)
                payload = jwt.decode(
                    token,
                    public_key,
                    algorithms=[alg],
                    audience="authenticated",
                    options={"verify_aud": True, "verify_exp": True, "verify_signature": True},
                )
                sub = payload.get("sub")
                if not sub:
                    raise InvalidTokenError("Token missing `sub` claim")
                return payload
            except ExpiredSignatureError as exc:
                raise InvalidTokenError("Token expired") from exc
            except JWTClaimsError as exc:
                raise InvalidTokenError(f"Invalid token claims: {exc}") from exc
            except JWTError as exc:
                last_error = exc
                continue

        # If no JWKS keys matched, log and fail
        logger.warning(
            "JWT verification failed — alg: %s, kid: %s, keys available: %d, error: %s",
            alg, kid, len(keys), last_error,
        )
        raise InvalidTokenError(f"Invalid token: {last_error}") from last_error

    # --- Symmetric (HS256/384/512) via JWT secret ---
    if not settings.supabase_jwt_secret:
        raise InvalidTokenError("SUPABASE_JWT_SECRET not configured (needed for HS* tokens)")

    secrets = _candidate_hmac_secrets(settings.supabase_jwt_secret)
    for secret in secrets:
        try:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256", "HS384", "HS512"],
                audience="authenticated",
                options={"verify_aud": True, "verify_exp": True, "verify_signature": True},
            )
            sub = payload.get("sub")
            if not sub:
                raise InvalidTokenError("Token missing `sub` claim")
            return payload
        except ExpiredSignatureError as exc:
            raise InvalidTokenError("Token expired") from exc
        except JWTClaimsError as exc:
            raise InvalidTokenError(f"Invalid token claims: {exc}") from exc
        except JWTError as exc:
            last_error = exc
            continue

    logger.warning("JWT verification failed with all HMAC secrets: %s", last_error)
    raise InvalidTokenError(f"Invalid token: {last_error}") from last_error
