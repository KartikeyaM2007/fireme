import os
from typing import Optional

import jwt
from fastapi import Header, HTTPException, Query
from jwt import PyJWKClient

_jwks_client: PyJWKClient | None = None


def _decode_clerk_token(token: str) -> str:
    jwks_url = os.getenv("CLERK_JWKS_URL")
    issuer = os.getenv("CLERK_ISSUER")
    if not jwks_url or not issuer:
        raise HTTPException(
            503,
            "Clerk verification is not configured. Set CLERK_JWKS_URL and CLERK_ISSUER in backend/.env",
        )
    try:
        global _jwks_client
        _jwks_client = _jwks_client or PyJWKClient(jwks_url)
        key = _jwks_client.get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token, key, algorithms=["RS256"], issuer=issuer, options={"verify_aud": False}
        )
        allowed = {
            x.strip()
            for x in os.getenv("CLERK_AUTHORIZED_PARTIES", "http://localhost:3000").split(",")
            if x.strip()
        }
        if allowed and claims.get("azp") not in allowed:
            raise ValueError("untrusted authorized party")
        user_id = str(claims.get("sub", "")).strip()
        if not user_id:
            raise ValueError("missing subject")
        return user_id
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(401, "Invalid or expired Clerk session") from exc


def current_user(authorization: str | None = Header(default=None)) -> str:
    """Verify a Clerk session JWT and return its immutable Clerk user id."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    return _decode_clerk_token(authorization.removeprefix("Bearer ").strip())


def media_user(
    authorization: str | None = Header(default=None),
    access_token: str | None = Query(default=None),
) -> str:
    """Auth for media streaming: Bearer header or access_token query (for <video>/<audio> tags)."""
    if authorization and authorization.startswith("Bearer "):
        return _decode_clerk_token(authorization.removeprefix("Bearer ").strip())
    if access_token:
        return _decode_clerk_token(access_token.strip())
    raise HTTPException(401, "Authentication required")
