# KK & SONS Architectural Services — Workforce Management (admin dashboard)

Next.js 14 PWA + Firebase (Auth, Firestore) for construction-workforce
attendance, weekly payroll, advances, loans, transport and reports.

```bash
cp .env.example .env.local   # Firebase web config
npm ci
npm run dev        # local
npm run typecheck  # TypeScript
npm test           # payroll / attendance / timezone unit tests
npm run build      # static export → out/
```

Full documentation (architecture, payroll rules, security rules deployment
order, access matrix, testing): **[../docs/README.md](../docs/README.md)**.

© 2026 KK & SONS Architectural Services. All rights reserved.
