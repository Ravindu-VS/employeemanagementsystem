# Backend services (FastAPI)

Two small, independent services. The web app works without them; each one
adds a capability when its URL is configured.

| Service | What it adds | Web app variable |
|---|---|---|
| `ai-service` | HR assistant answers written by Claude, grounded only in the retrieved HR passages and cited `[n]`. Without `ANTHROPIC_API_KEY` it returns extractive answers. | `NEXT_PUBLIC_AI_ENDPOINT` |
| `notification-service` | Email (SMTP) and SMS (Notify.lk or a generic HTTP gateway) for approvals and payments. Unconfigured channels return `skipped`, nothing is faked. | `NEXT_PUBLIC_NOTIFY_ENDPOINT` |

**Security.** Every request carries the user's Firebase ID token, verified
against `FIREBASE_PROJECT_ID`. The notification service also reads the
caller's role from Firestore *with the caller's own token* (so the security
rules apply) and only lets supervisors and above send. Both services rate-limit
per user. Secrets (`ANTHROPIC_API_KEY`, `SMTP_PASSWORD`, `SMS_API_KEY`) belong
in Cloud Run / Secret Manager, never in git.

## Run locally

```bash
cd backend
cp .env.example .env        # fill in what you need
docker compose up --build   # ai on :8081, notify on :8082
```

Then in the web app's `.env.local`:

```
NEXT_PUBLIC_AI_ENDPOINT=http://localhost:8081
NEXT_PUBLIC_NOTIFY_ENDPOINT=http://localhost:8082
```

## Test

```bash
cd backend/ai-service && pip install -r requirements.txt -r requirements-dev.txt && python -m pytest -q
cd backend/notification-service && pip install -r requirements.txt -r requirements-dev.txt && python -m pytest -q
```

CI runs both on every push.

## Deploy

GitHub → Actions → **Deploy backend (Cloud Run)** → choose the service. See the
workflow header for the secrets and variables it needs. Then set
`NEXT_PUBLIC_AI_ENDPOINT` / `NEXT_PUBLIC_NOTIFY_ENDPOINT` as repository
**variables** and re-run the Pages deploy.
