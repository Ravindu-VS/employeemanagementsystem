"""Firebase ID token verification (Bearer token from the web app)."""
from __future__ import annotations

import os
from dataclasses import dataclass

from fastapi import Header, HTTPException, status


@dataclass
class Caller:
    uid: str
    email: str | None
    token: str


def _verify(token: str) -> dict:
    # google-auth fetches and caches Google's public certs.
    from google.auth.transport import requests as g_requests
    from google.oauth2 import id_token

    project = os.environ.get("FIREBASE_PROJECT_ID")
    if not project:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "FIREBASE_PROJECT_ID is not set")
    try:
        return id_token.verify_firebase_token(token, g_requests.Request(), audience=project)
    except Exception as exc:  # invalid, expired, wrong project
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired sign-in token") from exc


def current_caller(authorization: str | None = Header(default=None)) -> Caller:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    claims = _verify(token)
    uid = claims.get("user_id") or claims.get("sub")
    if not uid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token has no user")
    return Caller(uid=uid, email=claims.get("email"), token=token)
