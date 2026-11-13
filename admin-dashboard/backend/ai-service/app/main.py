"""
KK & SONS HR assistant — AI service.

POST /ask  {question, passages:[{doc_id,title,text}]}
  The web app retrieves the passages (BM25) and sends them here. The model is
  told to answer ONLY from those passages and to cite them as [n]. If no
  ANTHROPIC_API_KEY is configured, an extractive answer is returned instead.
GET /health
"""
from __future__ import annotations

import os
import re
import time
from collections import defaultdict, deque

import httpx
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .auth import Caller, current_caller

app = FastAPI(title="KK & SONS AI service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()],
    allow_methods=["POST", "GET"],
    allow_headers=["Authorization", "Content-Type"],
)

SYSTEM_PROMPT = (
    "You are the HR assistant for KK & SONS Architectural Services in Sri Lanka. "
    "Answer the employee's question using ONLY the numbered passages provided. "
    "Cite passages like [1] or [2]. If the passages do not contain the answer, say you could not "
    "find it in the HR documents and suggest asking a manager. Never invent policy, amounts or dates. "
    "Keep answers short and plain. Amounts are in LKR."
)


class PassageIn(BaseModel):
    doc_id: str = Field(max_length=200)
    title: str = Field(max_length=300)
    text: str = Field(max_length=4000)


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    passages: list[PassageIn] = Field(default_factory=list, max_length=8)


class AskOut(BaseModel):
    answer: str
    model: str
    citations: list[str]


# --- simple per-user rate limit (20 questions / 5 minutes) ---
_WINDOW, _LIMIT = 300.0, int(os.environ.get("ASK_RATE_LIMIT", "20"))
_hits: dict[str, deque[float]] = defaultdict(deque)


def _rate_limit(uid: str) -> None:
    now = time.monotonic()
    q = _hits[uid]
    while q and now - q[0] > _WINDOW:
        q.popleft()
    if len(q) >= _LIMIT:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many questions — try again in a few minutes")
    q.append(now)


_STOP = set("a an and are as at be by can do does for from has have how i if in is it its me my of on or our so that the their them then there this to was we what when where which who why will with you your".split())


def _tokens(s: str) -> set[str]:
    return {t for t in re.sub(r"[^a-z0-9\s]", " ", s.lower()).split() if len(t) > 1 and t not in _STOP}


def extractive_answer(question: str, passages: list[PassageIn], max_sentences: int = 3) -> str:
    q = _tokens(question)
    scored = []
    for pi, p in enumerate(passages):
        for si, s in enumerate(re.findall(r"[^.!?\n]+[.!?]?", p.text)):
            hits = len(_tokens(s) & q)
            if hits and len(s.strip()) > 3:
                scored.append((hits, pi, si, f"{s.strip()} [{pi + 1}]"))
    best = sorted(scored, key=lambda x: (-x[0], x[1], x[2]))[:max_sentences]
    best.sort(key=lambda x: (x[1], x[2]))
    return " ".join(b[3] for b in best)


async def anthropic_answer(question: str, passages: list[PassageIn]) -> tuple[str, str]:
    model = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-5-5")
    context = "\n\n".join(f"[{i + 1}] {p.title}\n{p.text}" for i, p in enumerate(passages))
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": os.environ["ANTHROPIC_API_KEY"],
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 600,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": f"Passages:\n{context}\n\nQuestion: {question}"}],
            },
        )
    r.raise_for_status()
    data = r.json()
    text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text").strip()
    return text, data.get("model", model)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "llm": bool(os.environ.get("ANTHROPIC_API_KEY"))}


@app.post("/ask", response_model=AskOut)
async def ask(body: AskIn, caller: Caller = Depends(current_caller)) -> AskOut:
    _rate_limit(caller.uid)
    citations = [p.doc_id for p in body.passages]
    if not body.passages:
        return AskOut(answer="I couldn't find this in the HR documents. Please ask your manager.", model="none", citations=[])
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            text, model = await anthropic_answer(body.question, body.passages)
            if text:
                return AskOut(answer=text, model=model, citations=citations)
        except Exception:  # fall back rather than fail the user
            pass
    return AskOut(answer=extractive_answer(body.question, body.passages) or body.passages[0].text, model="extractive", citations=citations)
