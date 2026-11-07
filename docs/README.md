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

### Future backend (optional, not live)

`backend-services/` (outer project folder, not part of this repository's
deployment) holds FastAPI + PostgreSQL scaffolding: docker-compose,
health-check services and a basic employee/attendance CRUD prototype. It does
not implement payroll rules. If the backend is ever moved off Firebase,
replace the Firestore calls inside `src/services/*` with HTTP calls — the
domain layer (all business rules) stays unchanged, so nothing is
re-implemented. Migrate data with a one-way, verified copy; never run
Firestore and PostgreSQL as two writable sources of truth.

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

Environments: development (`.env.local`), staging/production (GitHub Actions
secrets → `NEXT_PUBLIC_*` at build time). Secrets are never committed;
The optional `backend-services/.env` holds the PostgreSQL password.

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

## 7. Week-definition migration note

Earlier versions used a Sunday→Saturday payroll week. Stored payroll keeps
its own `weekStartDate`; the payroll page shows legacy records for the
overlapping week, and the paid-date exclusion prevents double payment during
the transition week.

---

## 8. Testing

```bash
npm run typecheck    # TypeScript
npm run lint         # ESLint (zero warnings allowed)
npm test             # unit tests: payroll engine, attendance persistence, dates, leave, anomalies, UI
TZ=Pacific/Kiritimati npm test   # same results in any timezone
npm run test:rules   # Firestore security rules on the emulator (needs Java)
npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs all of the above — including
the security-rules tests on the real emulator — on every push and pull request.

Manual acceptance on staging (attendance §77): mark Present → save → refresh →
Absent → save → refresh → navigate away and back → Present → save → refresh;
repeat with two sites, morning/evening split, a supervisor, a Sunday and a
driver. Never test on production payroll data.

---

## 9. Deployment

GitHub Actions (`.github/workflows/deploy.yml`) builds the
static export and publishes to GitHub Pages; Firebase config comes from
repository secrets. Firestore rules are deployed separately with the
Firebase CLI (see §3 for the order).
