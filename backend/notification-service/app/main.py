"""
KK & SONS notification service — email (SMTP) and SMS.

POST /notify {channel: "email"|"sms", to, subject?, message}
  Caller must be signed in (Firebase ID token) AND hold a staff role
  (owner/ceo/manager/supervisor). The role is read from Firestore with the
  caller's OWN token, so Firestore security rules apply.
  Unconfigured channels return {"status": "skipped"} — nothing is faked.
GET /health
"""
from __future__ import annotations

import os
import re
import smtplib
import time
from collections import defaultdict, deque
from email.message import EmailMessage
from typing import Literal

import httpx
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, model_validator

from .auth import Caller, current_caller

app = FastAPI(title="KK & SONS notification service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()],
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)

SENDER_ROLES = {"owner", "ceo", "manager", "supervisor"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_lk_phone(raw: str) -> str:
    """0771234567 / +94 77 123 4567 / 94771234567 → 94771234567."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("0") and len(digits) == 10:
        digits = "94" + digits[1:]
    if len(digits) == 9 and digits.startswith("7"):
        digits = "94" + digits
    if not re.fullmatch(r"94\d{9}", digits):
        raise ValueError("Phone number must be a Sri Lankan number like 0771234567")
    return digits


class NotifyIn(BaseModel):
    channel: Literal["email", "sms"]
    to: str = Field(min_length=3, max_length=200)
    subject: str | None = Field(default=None, max_length=200)
    message: str = Field(min_length=1, max_length=1600)

    @model_validator(mode="after")
    def _check_to(self) -> "NotifyIn":
        if self.channel == "email":
            if not EMAIL_RE.match(self.to):
                raise ValueError("Invalid email address")
        else:
            self.to = normalize_lk_phone(self.to)
            if len(self.message) > 480:
                raise ValueError("SMS is limited to 480 characters")
        return self


class NotifyOut(BaseModel):
    status: Literal["sent", "skipped"]
    channel: str
    detail: str = ""


# --- 60 messages / 10 minutes per sender ---
_WINDOW, _LIMIT = 600.0, int(os.environ.get("NOTIFY_RATE_LIMIT", "60"))
_hits: dict[str, deque[float]] = defaultdict(deque)


def _rate_limit(uid: str) -> None:
    now = time.monotonic()
    q = _hits[uid]
    while q and now - q[0] > _WINDOW:
        q.popleft()
    if len(q) >= _LIMIT:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many notifications — slow down")
    q.append(now)


def caller_role(caller: Caller) -> str | None:
    """Read users/{uid}.role from Firestore REST using the caller's own token."""
    project = os.environ["FIREBASE_PROJECT_ID"]
    url = f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/users/{caller.uid}"
    r = httpx.get(url, headers={"Authorization": f"Bearer {caller.token}"}, timeout=10)
    if r.status_code != 200:
        return None
    fields = r.json().get("fields", {})
    active = fields.get("isActive", {}).get("booleanValue") is True
    role = fields.get("role", {}).get("stringValue")
    return role if active else None


def require_sender(caller: Caller = Depends(current_caller)) -> Caller:
    if caller_role(caller) not in SENDER_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only supervisors and above can send notifications")
    return caller


def send_email(to: str, subject: str, body: str) -> NotifyOut:
    host = os.environ.get("SMTP_HOST")
    if not host:
        return NotifyOut(status="skipped", channel="email", detail="SMTP is not configured")
    msg = EmailMessage()
    msg["From"] = os.environ.get("SMTP_FROM", os.environ.get("SMTP_USER", "no-reply@localhost"))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(f"{body}\n\n— KK & SONS Architectural Services")
    port = int(os.environ.get("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=20) as s:
        if os.environ.get("SMTP_STARTTLS", "true").lower() != "false":
            s.starttls()
        if os.environ.get("SMTP_USER"):
            s.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
        s.send_message(msg)
    return NotifyOut(status="sent", channel="email")


def send_sms(to: str, body: str) -> NotifyOut:
    provider = os.environ.get("SMS_PROVIDER", "").lower()
    if provider == "notifylk":
        params = {
            "user_id": os.environ["SMS_USER_ID"],
            "api_key": os.environ["SMS_API_KEY"],
            "sender_id": os.environ.get("SMS_SENDER_ID", "NotifyDEMO"),
            "to": to,
            "message": body,
        }
        r = httpx.get("https://app.notify.lk/api/v1/send", params=params, timeout=20)
    elif provider == "generic" and os.environ.get("SMS_GATEWAY_URL"):
        r = httpx.post(
            os.environ["SMS_GATEWAY_URL"],
            json={"to": to, "message": body, "sender": os.environ.get("SMS_SENDER_ID", "")},
            headers={"Authorization": f"Bearer {os.environ.get('SMS_API_KEY', '')}"},
            timeout=20,
        )
    else:
        return NotifyOut(status="skipped", channel="sms", detail="SMS gateway is not configured")
    if r.status_code >= 300:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"SMS gateway error {r.status_code}")
    return NotifyOut(status="sent", channel="sms")


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "email": bool(os.environ.get("SMTP_HOST")),
        "sms": os.environ.get("SMS_PROVIDER", "") in {"notifylk", "generic"},
    }


@app.post("/notify", response_model=NotifyOut)
def notify(body: NotifyIn, caller: Caller = Depends(require_sender)) -> NotifyOut:
    _rate_limit(caller.uid)
    try:
        if body.channel == "email":
            return send_email(body.to, body.subject or "KK & SONS notification", body.message)
        return send_sms(body.to, body.message)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"Could not send {body.channel}: {type(exc).__name__}") from exc
