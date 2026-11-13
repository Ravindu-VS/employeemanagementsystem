# KK & SONS Architectural Services — Workforce Management (admin dashboard)

Next.js 14 PWA + Firebase (Auth, Firestore) for construction-workforce
attendance, weekly payroll, advances, loans, transport, reports, employee
self-service, an HR assistant, recruitment, assets, org chart and analytics.
Optional FastAPI services in `backend/` add AI answers and email/SMS.

```bash
cp .env.example .env.local   # Firebase web config
npm ci
npm run dev        # local
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm test           # unit tests
npm run test:rules # Firestore rules (emulator)
npm run build      # static export → out/
```

Full documentation (architecture, payroll rules, security rules deployment
order, access matrix, testing): **[docs/README.md](docs/README.md)**.

© 2026 KK & SONS Architectural Services. All rights reserved.
