import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("FIREBASE_PROJECT_ID", "test-project")
os.environ.pop("ANTHROPIC_API_KEY", None)

from app import main  # noqa: E402
from app.auth import Caller, current_caller  # noqa: E402

PASSAGES = [
    {"doc_id": "builtin-payroll", "title": "How weekly pay is calculated",
     "text": "Overtime (OT) rate is your daily salary divided by 8 for each OT hour. Sunday is the weekly holiday."},
    {"doc_id": "builtin-leave", "title": "Leave policy", "text": "You get 14 days annual leave."},
]


@pytest.fixture
def client():
    main.app.dependency_overrides[current_caller] = lambda: Caller(uid="u1", email=None, token="t")
    main._hits.clear()
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


def test_health():
    assert TestClient(main.app).get("/health").json() == {"status": "ok", "llm": False}


def test_requires_token():
    r = TestClient(main.app).post("/ask", json={"question": "x", "passages": []})
    assert r.status_code == 401


def test_extractive_answer_cites(client):
    r = client.post("/ask", json={"question": "what is the OT rate", "passages": PASSAGES})
    assert r.status_code == 200
    j = r.json()
    assert "divided by 8" in j["answer"] and "[1]" in j["answer"]
    assert j["model"] == "extractive"
    assert j["citations"] == ["builtin-payroll", "builtin-leave"]


def test_no_passages_does_not_guess(client):
    j = client.post("/ask", json={"question": "zebra", "passages": []}).json()
    assert "couldn't find" in j["answer"]


def test_validation(client):
    assert client.post("/ask", json={"question": "", "passages": []}).status_code == 422
    assert client.post("/ask", json={"question": "x", "passages": PASSAGES * 5}).status_code == 422


def test_rate_limit(client, monkeypatch):
    monkeypatch.setattr(main, "_LIMIT", 2)
    for _ in range(2):
        assert client.post("/ask", json={"question": "OT", "passages": PASSAGES}).status_code == 200
    assert client.post("/ask", json={"question": "OT", "passages": PASSAGES}).status_code == 429


def test_llm_used_when_configured(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")

    async def fake(q, p):
        return "OT is daily salary / 8 [1].", "claude-test"

    monkeypatch.setattr(main, "anthropic_answer", fake)
    j = client.post("/ask", json={"question": "OT?", "passages": PASSAGES}).json()
    assert j == {"answer": "OT is daily salary / 8 [1].", "model": "claude-test", "citations": ["builtin-payroll", "builtin-leave"]}


def test_llm_failure_falls_back(client, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "k")

    async def boom(q, p):
        raise RuntimeError("down")

    monkeypatch.setattr(main, "anthropic_answer", boom)
    assert client.post("/ask", json={"question": "OT rate", "passages": PASSAGES}).json()["model"] == "extractive"
