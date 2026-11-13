# KK & SONS Architectural Services — Workforce Management System

Single authoritative documentation for the system (architecture, setup,
business rules, security, deployment, testing). © 2026 KK & SONS
Architectural Services. All rights reserved. Third-party libraries keep their
own licences.

---

## 1. Architecture

### Today (production)

```text
Next.js 14 PWA (static export, GitHub Pages)      src/app, src/components
        ↓  UI only — renders domain results
Domain (pure TypeScript, unit-tested)             src/domain
   attendance/  normalizeAttendance()  ← the only reader of raw attendance fields
   payroll/     computePayroll()       ← the only payroll calculation
   advances/  transport/  sites/  leave/  anomalies/  roles/ (access matrix)
        ↓
Services (Firestore data access, no business maths) src/services
        ↓
Firebase Auth + Cloud Firestore (+ Storage)      secured by firestore.rules
```

Record pages use query strings (`/dashboard/employees/view?id=…`,
`/dashboard/sites/edit?id=…`) so every record opens on the static GitHub
Pages build.

Rule of the codebase: **pages never calculate pay or days**. Payroll page,
stored payroll generation, reports and the dashboard all call the same
`computePayroll()` / `normalizeAttendance()`.

### Backend services (optional, `backend/`)

```text
Web app ──(Firebase ID token)──▶ ai-service (FastAPI)            /ask   → Claude, grounded in retrieved passages
        ──(Firebase ID token)──▶ notification-service (FastAPI)  /notify → SMTP email, Notify.lk / HTTP SMS
```

Both are optional and stateless. Without them the app still works: the HR
assistant answers extractively in the browser and notifications stay in-app.
They never touch payroll data or rules. Setup, security model, tests and
Cloud Run deployment: **[backend/README.md](../backend/README.md)**.

The old `backend-services/` PostgreSQL prototype in the outer folder is not
used and holds no business rules.

---

## 2. Setup

```bash
cp .env.example .env.local     # fill in Firebase web config
npm ci
npm run dev                    # http://localhost:3000
npm run typecheck && npm test && npm run build
```

Firebase project: enable Email/Password (and optionally Google) sign-in under
Authentication → Sign-in method; add your domains under Authorized domains;
deploy `firestore.rules` as described in §3. Do **not** use open
"any signed-in user may write" rules.

Environments: development (`.env.local`), **staging** (Firebase Hosting
channel `staging`, see §9) and production (GitHub Pages). Values come from
GitHub Actions secrets/variables → `NEXT_PUBLIC_*` at build time. Secrets are
never committed. Optional: `NEXT_PUBLIC_AI_ENDPOINT`,
`NEXT_PUBLIC_NOTIFY_ENDPOINT` (backend service URLs).

---

## 3. Security, roles and access

**Signup:** public signup creates a *pending* account (`role: null`,
`isActive: false`). An Owner/CEO approves it in **User Approvals** and assigns
the role. Nobody can self-assign a role — enforced by `firestore.rules`.
Only the very first account of a brand-new project becomes Owner, and only
while `system/bootstrap` does not exist (it is created in the same write).

**Deploying the rules on the existing project (order matters):**
1. Deploy this app version.
2. The Owner signs in once → the app creates `system/bootstrap` (locks the
   first-owner path).
3. `firebase deploy --only firestore:rules`
4. Optional: `npm run test:rules` (needs Java; runs the rules tests on the emulator).

| Area | Owner | CEO | Manager | Supervisor | Draughtsman / Bass / Helper | Driver |
|---|---|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| User approvals, assign roles | ✓ | ✓ (not Owner/CEO) | – | – | – | – |
| Employees (view) | ✓ | ✓ | ✓ | ✓ (read) | – | – |
| Employees (create/edit salary) | ✓ | ✓ | ✓ (non-admin staff, no roles) | – | – | – |
| Sites | ✓ | ✓ | ✓ | – | – | – |
| Attendance marking | ✓ | ✓ | ✓ | ✓ | – | – |
| Payroll, advances, loans, transport, reports | ✓ | ✓ | ✓ | – | own records only (rules) | own records only (rules) |
| Settings, audit logs | ✓ | ✓ | – | – | – | – |
| Leave: request own / see own balance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Leave: approve / reject | ✓ | ✓ | ✓ | – | – | – |
| Transport (vehicles, routes) | ✓ | ✓ | ✓ | – | – | – |
| My Portal (own attendance, payslips + PDF, advances, loans) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| HR Assistant (ask) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| HR knowledge base (edit) | ✓ | ✓ | – | – | – | – |
| Recruitment, assets, analytics | ✓ | ✓ | ✓ | – | – | – |
| Assets: see items assigned to me | ✓ | ✓ | ✓ | ✓ | ✓ (rules) | ✓ (rules) |
| Org chart | ✓ | ✓ | ✓ | ✓ | – | – |
| System (health, errors, migration) | ✓ | ✓ | – | – | – | – |

The UI matrix is `src/domain/roles/index.ts → ACCESS_MATRIX`; the same rules
are enforced server-side in `firestore.rules`. Stored payroll amounts are
immutable (only status/payment fields may change); a deducted advance can
never be un-deducted or deleted; audit logs are append-only; attendance and
sites are never hard-deleted (sites/employees are archived/deactivated).

**Audit log** entries (actor, action, target, timestamp, change) are written
for employee create/update/role/salary changes, deactivation, site
create/status/archive, attendance saves, payroll approval and payment,
advance create/approve/reject/edit/delete/deduct/carry-forward, loan actions,
settings changes, user approval/rejection and login.

---

## 4. Attendance

Collection `simpleAttendance`, **deterministic ids**:

| Document id | Content |
|---|---|
| `{workerId}_{yyyy-MM-dd}` | `siteShifts: {siteId: {morning, evening}}`, `siteOtHours: {siteId: hours}` |
| `{workerId}_{yyyy-MM-dd}_driver` | `morningPresent`, `eveningPresent`, `morningOtHours`, `eveningOtHours` |

Every site lives under its own key, so saving Site B cannot change Site A and
OT can never move between sites. A whole screen is saved in **one
transaction** (fast, atomic), then re-read from the server, verified and the
rows are rebuilt from the server data — the UI is never the source of truth.

Role models (decided by the employee's **current** role):

* **Labor** (Draughtsman, Bass, Helper): morning = 0.5, evening = 0.5. Morning
  at Site A + evening at Site B is allowed; the same shift at two sites is rejected.
* **Multi-site** (Supervisor, Manager, CEO, Owner): may be marked at any
  number of sites on the same day.
* **Driver**: no site; marked in the Drivers section (morning / evening shift).

Sites: Active / Planning / On hold are selectable; Completed is read-only;
Inactive / Archived / Cancelled are not offered for new attendance. Inactive
employees are not offered either. History is never removed.

**Legacy data:** older random-id documents (`morningSite`/`eveningSite`,
single `otHours`, `siteVisits`) remain readable. When a worker/day is saved
again, legacy documents are folded into the deterministic one and flagged
`superseded: true` (never deleted). Duplicate legacy documents for different
sites are combined (the old "36 → 31 after merge" loss is gone); identical
allocations count once; if a labor shift appears at two sites the most
recently updated document wins and an anomaly is shown.

**Timezone:** every business date is an Asia/Colombo calendar date
(`yyyy-MM-dd`); conversions use `Intl` with `Asia/Colombo`, so the browser's
timezone never changes a date (tested from UTC−12 to UTC+14).

---

## 5. Payroll engine (`src/domain/payroll/engine.ts`)

Period = payroll week **Monday → Sunday** (Mon–Sat working days; Sunday counts
only when emergency Sunday attendance was actually marked). Only attendance
dated inside the period is used — a worker who worked last week but not this
week gets 0.

| Component | Rule |
|---|---|
| Labor day pay | Σ(0.5 per shift) × daily salary effective on that date, per site |
| Supervisor | 1 visit per distinct site per day × site-visit rate (employee `siteVisitRate` → Settings → **2,000 LKR**). 4 sites → 8,000. |
| Owner / CEO / Manager | per site visit at `siteVisitRate`, or their daily salary per visit |
| Driver | Σ(0.5 per shift) × daily salary (line "Driver duty", never site payroll) |
| OT | OT hours × (daily salary ÷ 8), only at the site/duty where recorded |
| Transport | per day / per km / per week / per site / **distance band** (Settings) |
| Gross | site pay + driver pay + OT + transport |
| Advances | approved, not yet deducted, dated ≤ week end; "Deduct this week" ticked → deducted, unticked → carried forward (offered again next week) |
| Loans | each active loan: min(instalment, remaining balance) |
| Final | Gross − advance deductions − loan deductions (negative results are flagged, not hidden) |

Salary changes are kept in `salaryHistory`; each attendance date uses the
rate effective on that date. Stored `otRate` is ignored.

Totals: each site total (all employees at that site), employee totals (all
sites of that employee) and the grand total
`site totals + driver duty + transport − advances − loans = final payroll`.

**Approving payroll** stores one document per employee per week
(`payroll/{weekStart}_{uid}`, never duplicated) in a transaction that also
marks ticked advances deducted (`isDeducted` + `deducted`, deduction week,
payroll id) and unticked ones carried forward. Dates already covered by any
stored payroll (including legacy Sunday→Saturday weeks) are excluded from
later previews, so a day is never paid twice. **Mark paid** records each loan
instalment once (idempotent per payroll id).

Data-quality findings (OT without shift, OT with no daily salary, shift at two
sites, missing employee record, deductions above gross) are listed — the
engine never silently changes pay.

---

## 6. Leave, notifications, transport, anomaly flags

* **Leave** (`/dashboard/leave`, `domain/leave`): request → Owner/CEO/Manager
  approve or reject (reason required) → balance recomputed from approved
  requests (annual 14 / sick 7 / casual 7 days per year by default, editable
  in the `settings/leave` document) → the employee is notified. Working days
  are Mon–Sat; overlaps and over-balance requests are refused. Leave is
  unpaid for daily-wage staff — payroll pays attendance only.
* **Notifications** (header bell, `services/notification-service`): stored per
  user (or per role as `role:<role>`), sent for account approval, advance
  decisions, leave requests/decisions, payroll approval and payment; click
  marks read and opens the related page.
* **Transport** (`/dashboard/transport`): vehicles (registration, type,
  seats, driver, status) and routes (site, distance, vehicle, driver,
  passengers, capacity check, matching distance band). Allowances for
  employees who travel on their own are set per employee and in Settings.
* **Anomaly flags** (`domain/anomalies`): excessive OT, unusual site visits,
  duplicate/conflicting shifts, OT without attendance, large deductions,
  salary jumps, unusual site totals. Shown before approving payroll; they
  never change attendance or pay (a future ML model can add findings there).

## 7. Employee self-service, HR assistant, recruitment, assets, org chart, analytics

* **My Portal** (`/dashboard/me`): every employee sees their own weekly
  attendance (per site, shift and OT), stored payslips with a branded **PDF
  download** (`lib/payslip-pdf.ts` — prints only the stored figures), their
  advances (and can request one; managers are notified) and loans. Firestore
  rules only return the person's own records.
* **HR Assistant** (`/dashboard/assistant`, `domain/hr-assistant`):
  1. personal questions ("how many leave days do I have left?", "explain my
     last payslip", "status of my advance", "my loan balance") are answered
     from the person's own records only;
  2. policy questions use retrieval (BM25 over built-in rules generated from
     the same constants the payroll engine uses + HR documents that
     Owner/CEO add in the Knowledge base tab, with "everyone" / "managers"
     audiences enforced by the rules);
  3. with `NEXT_PUBLIC_AI_ENDPOINT` set, the retrieved passages go to the
     ai-service and Claude writes the answer **only from those passages**,
     citing them; otherwise the most relevant sentences are quoted. Every
     answer shows its sources; when nothing matches it says so instead of
     guessing.
* **Recruitment** (`/dashboard/recruitment`, `domain/recruitment`): job
  postings with required / nice-to-have skills and minimum experience;
  candidates' CV text → skills extracted from a construction vocabulary →
  transparent score (70 % required skills, 20 % nice-to-have, 10 %
  experience) with matched / missing skills shown. **No automatic
  rejection:** the list is only sorted; each stage change is a person's
  click (recorded as `stageChangedBy`), rejection needs a written reason, and
  the Firestore rules enforce both.
* **Assets** (`/dashboard/assets`, `domain/assets`): register tools,
  equipment, safety gear, IT; assign to an employee and/or site, return,
  maintenance, back in service, retire. Every change is kept in the asset's
  history and the audit log; assets are never deleted.
* **Org chart** (`/dashboard/org-chart`, `domain/org`): Owner → CEO →
  Manager → Supervisor → site staff (placed under the supervisor of their
  site) and drivers under a manager; "Reports to" on the employee edit page
  overrides the line. Cycles are prevented.
* **Analytics** (`/dashboard/analytics`, `domain/analytics`): headcount by
  role, weekly earnings and OT trends, top OT, site utilisation (worker-days,
  visits, OT, labour cost) for 4–26 weeks. It runs `computePayroll()` week by
  week, so the numbers equal Payroll/Reports. Table view available.
* **Email / SMS** (`services/external-notify.ts`): when the notification
  service is configured, notifications to a person also go by SMS (Settings →
  Notifications → SMS) and/or email. Unconfigured channels are skipped, never
  faked.

## 8. Monitoring and the one-off legacy migration

* Uncaught browser errors and page crashes (`app/error.tsx`,
  `app/global-error.tsx`, window handlers) are written to `clientErrors`
  (deduplicated, max 20 per session) and listed on **System** with the health
  of Firestore and both backend services.
* **Legacy attendance migration** (System page): *Check (dry run)* lists
  every worker-day still stored under old random-ID documents; *Migrate*
  writes the deterministic document (`{workerId}_{date}` /
  `{workerId}_{date}_driver`) and flags the old ones `superseded` — nothing
  is deleted. A unit test proves `normalizeAttendance()` gives identical
  shifts and OT before and after, and that a second run does nothing.
  Payroll already reads legacy data correctly, so this step is optional
  housekeeping. Run it once, outside payroll approval.

## 9. Week-definition migration note

Earlier versions used a Sunday→Saturday payroll week. Stored payroll keeps
its own `weekStartDate`; the payroll page shows legacy records for the
overlapping week, and the paid-date exclusion prevents double payment during
the transition week.

---

## 10. Testing

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint (zero warnings allowed)
npm test             # unit tests: payroll engine, attendance persistence, dates, leave, anomalies, UI
TZ=Pacific/Kiritimati npm test   # same results in any timezone
npm run test:rules   # Firestore security rules on the emulator (needs Java)
npm run build
cd backend/ai-service && python -m pytest -q            # backend services
cd backend/notification-service && python -m pytest -q
```

GitHub Actions (`.github/workflows/ci.yml`) runs all of the above — including
the security-rules tests on the real emulator — on every push and pull request.

Manual acceptance on staging (attendance §77): mark Present → save → refresh →
Absent → save → refresh → navigate away and back → Present → save → refresh;
repeat with two sites, morning/evening split, a supervisor, a Sunday and a
driver. Never test on production payroll data.

---

## 11. Deployment

| Workflow | When | Needs |
|---|---|---|
| `ci.yml` | every push / PR | nothing (placeholders) |
| `deploy.yml` → **production** (GitHub Pages) | push to `main` | secrets `NEXT_PUBLIC_FIREBASE_*`; optional variables `NEXT_PUBLIC_AI_ENDPOINT`, `NEXT_PUBLIC_NOTIFY_ENDPOINT` |
| `deploy-staging.yml` → **staging** (Firebase Hosting channel `staging`, plus a preview URL per PR) | push to `staging`, PRs | secret `FIREBASE_SERVICE_ACCOUNT`; optional `STAGING_FIREBASE_*` for a separate staging project |
| `deploy-backend.yml` → Cloud Run | manual | secret `GCP_SA_KEY`; variables `GCP_PROJECT_ID`, `GCP_REGION`, `ALLOWED_ORIGINS` |

Firestore rules are deployed separately with the Firebase CLI (see §3 for the
order). Release flow: merge to `staging` → check the staging URL → merge to
`main`.
