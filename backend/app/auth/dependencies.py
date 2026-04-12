"""FastAPI auth dependencies.

- CurrentUser: lightweight user record extracted from a verified JWT.
- get_current_user: required-auth dependency (raises 401 if missing/invalid).
- get_optional_user: returns None when no Authorization header is present.
- get_supabase_admin: lazy-initialized service-role Supabase client for DB writes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import Header, HTTPException, status

from app.auth.jwt_verifier import InvalidTokenError, verify_supabase_jwt
from app.config import settings


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None = None


def _extract_bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def get_optional_user(
    authorization: str | None = Header(default=None),
) -> Optional[CurrentUser]:
    """Return the caller if they have a valid token, else None.

    Use this on routes that should work for both signed-in and anonymous
    users (e.g. the upload route when `auth_required=False`).
    """
    token = _extract_bearer(authorization)
    if token is None:
        return None
    try:
        payload = verify_supabase_jwt(token)
    except InvalidTokenError:
        # Invalid token present — treat as "no user" when the route is optional.
        return None
    return CurrentUser(id=str(payload["sub"]), email=payload.get("email"))


def get_current_user(
    authorization: str | None = Header(default=None),
) -> CurrentUser:
    """Require a valid Supabase JWT. Raises 401 otherwise."""
    token = _extract_bearer(authorization)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization: Bearer <token> header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = verify_supabase_jwt(token)
    except InvalidTokenError as exc:
        # Log the token header for debugging algorithm issues
        import logging, json, base64
        logger = logging.getLogger(__name__)
        try:
            header_b64 = token.split(".")[0]
            # Fix padding
            header_b64 += "=" * (4 - len(header_b64) % 4)
            header = json.loads(base64.urlsafe_b64decode(header_b64))
            logger.warning("JWT rejected — header: %s, error: %s", header, exc)
        except Exception:
            logger.warning("JWT rejected — error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return CurrentUser(id=str(payload["sub"]), email=payload.get("email"))


# -- Supabase admin client (service role, used for DB writes) ------------------

_admin_client = None


def get_supabase_admin():
    """Return a lazy-initialized supabase.Client using the service role key.

    This bypasses RLS, so routes that use it are responsible for injecting the
    caller's user_id on every write/read.
    """
    global _admin_client
    if _admin_client is not None:
        return _admin_client

    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Supabase is not configured on the backend",
        )

    try:
        from supabase import create_client  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="supabase-py not installed on the backend",
        ) from exc

    _admin_client = create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )
    return _admin_client
