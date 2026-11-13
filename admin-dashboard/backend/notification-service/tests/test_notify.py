import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("FIREBASE_PROJECT_ID", "test-project")
for k in ("SMTP_HOST", "SMS_PROVIDER", "SMS_GATEWAY_URL"):
    os.environ.pop(k, None)

from app import main  # noqa: E402
from app.auth import Caller, current_caller  # noqa: E402


@pytest.fixture
def make_client(monkeypatch):
    def _make(role="manager"):
        main.app.dependency_overrides[current_caller] = lambda: Caller(uid="u1", email=None, token="t")
        monkeypatch.setattr(main, "caller_role", lambda c: role)
        main._hits.clear()
        return TestClient(main.app)

    yield _make
    main.app.dependency_overrides.clear()


def test_phone_normalisation():
    assert main.normalize_lk_phone("077 123 4567") == "94771234567"
    assert main.normalize_lk_phone("+94771234567") == "94771234567"
    assert main.normalize_lk_phone("771234567") == "94771234567"
    with pytest.raises(ValueError):
        main.normalize_lk_phone("12345")


def test_requires_token():
    assert TestClient(main.app).post("/notify", json={"channel": "sms", "to": "0771234567", "message": "hi"}).status_code == 401


def test_labour_roles_cannot_send(make_client):
    c = make_client("helper")
    assert c.post("/notify", json={"channel": "sms", "to": "0771234567", "message": "hi"}).status_code == 403
    c = make_client(None)  # inactive / pending
    assert c.post("/notify", json={"channel": "sms", "to": "0771234567", "message": "hi"}).status_code == 403


def test_unconfigured_channels_are_skipped_not_faked(make_client):
    c = make_client()
    assert c.post("/notify", json={"channel": "sms", "to": "0771234567", "message": "hi"}).json()["status"] == "skipped"
    assert c.post("/notify", json={"channel": "email", "to": "a@b.lk", "message": "hi"}).json()["status"] == "skipped"


def test_validation(make_client):
    c = make_client()
    assert c.post("/notify", json={"channel": "email", "to": "not-an-email", "message": "hi"}).status_code == 422
    assert c.post("/notify", json={"channel": "sms", "to": "123", "message": "hi"}).status_code == 422
    assert c.post("/notify", json={"channel": "sms", "to": "0771234567", "message": "x" * 500}).status_code == 422


def test_generic_sms_gateway(make_client, monkeypatch):
    monkeypatch.setenv("SMS_PROVIDER", "generic")
    monkeypatch.setenv("SMS_GATEWAY_URL", "https://sms.example/send")
    sent = {}

    class R:
        status_code = 200

    def fake_post(url, json, headers, timeout):
        sent.update(url=url, json=json)
        return R()

    monkeypatch.setattr(main.httpx, "post", fake_post)
    j = make_client().post("/notify", json={"channel": "sms", "to": "0771234567", "message": "Advance approved"}).json()
    assert j["status"] == "sent"
    assert sent["json"]["to"] == "94771234567"


def test_email_via_smtp(make_client, monkeypatch):
    monkeypatch.setenv("SMTP_HOST", "smtp.example")
    monkeypatch.setenv("SMTP_STARTTLS", "false")
    box = []

    class FakeSMTP:
        def __init__(self, host, port, timeout):
            box.append((host, port))

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def send_message(self, msg):
            box.append(msg["To"])

    monkeypatch.setattr(main.smtplib, "SMTP", FakeSMTP)
    j = make_client().post("/notify", json={"channel": "email", "to": "a@b.lk", "subject": "Payslip", "message": "Ready"}).json()
    assert j["status"] == "sent"
    assert box == [("smtp.example", 587), "a@b.lk"]


def test_rate_limit(make_client, monkeypatch):
    monkeypatch.setattr(main, "_LIMIT", 1)
    c = make_client()
    assert c.post("/notify", json={"channel": "sms", "to": "0771234567", "message": "a"}).status_code == 200
    assert c.post("/notify", json={"channel": "sms", "to": "0771234567", "message": "a"}).status_code == 429
