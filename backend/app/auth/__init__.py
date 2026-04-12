"""Auth module — Supabase JWT verification and FastAPI dependencies."""

from app.auth.dependencies import (
    CurrentUser,
    get_current_user,
    get_optional_user,
    get_supabase_admin,
)
from app.auth.jwt_verifier import InvalidTokenError, verify_supabase_jwt

__all__ = [
    "CurrentUser",
    "get_current_user",
    "get_optional_user",
    "get_supabase_admin",
    "verify_supabase_jwt",
    "InvalidTokenError",
]
