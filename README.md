# Employee Management System — Admin Dashboard

A production-ready **Construction Workforce Management System** built as a Progressive Web App (PWA) with Next.js and Firebase, designed for the Sri Lankan construction industry.

## Features

- **Dashboard** — Overview of workforce stats, attendance summary, and weekly payroll
- **Employee Management** — CRUD operations with worker ID format (WRK001), daily rate, OT rate, role-based hierarchy
- **Attendance Tracking** — Morning/Evening checkbox + OT hours per worker per site, designed for <5 seconds per worker
- **Weekly Payroll** — Auto-calculated from attendance: `(daysWorked × dailyRate) + (otHours × otRate) - deductions`
- **Advance Requests** — Workers can request salary advances; managers approve/reject
- **Loan Management** — Track loans with EMI schedules, interest rates, and remaining balances
- **Work Sites** — Manage construction sites with geofencing, supervisor assignments
- **Audit Logs** — Track all system actions for accountability
- **Reports** — Workforce analytics and financial summaries
- **Settings** — Company profile, notification preferences

## Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js 14** | App Router, TypeScript, Server Components |
| **Firebase** | Auth (Email/Google), Firestore, Storage |
| **Tailwind CSS** | Styling with Shadcn/Radix UI components |
| **Zustand** | Client-side auth state management |
| **TanStack Query** | Server state, caching, data fetching |
| **React Hook Form + Zod** | Form handling and validation |
| **next-pwa** | Progressive Web App support |

## Role Hierarchy

| Role | Access Level |
|---|---|
| Owner | Full system access |
| CEO | Full system access |
| Manager | Manage employees, sites, payroll |
| Supervisor | Attendance marking, view assigned sites |
| Draughtsman | Limited access |
| Bass | Limited access |
| Helper | Limited access |

## Getting Started

### Prerequisites

- Node.js 18+
- Firebase project with Firestore and Authentication enabled

### Installation

```bash
# Clone the repository
git clone https://github.com/Ravindu-VS/employeemanagementsystem.git
cd employeemanagementsystem

# Install dependencies
npm install
```

### Environment Setup

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication** → Sign-in method → Email/Password (and optionally Google)
3. Create a **Firestore Database**
4. Deploy security rules:

```bash
npx firebase-tools login
npx firebase-tools use your-project-id
npx firebase-tools deploy --only firestore:rules
```

Or manually set Firestore rules to:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The first user to sign up automatically receives the **Owner** role.

### Build for Production

```bash
npm run build
npm start
```

## Localization

- **Currency**: Sri Lankan Rupee (LKR)
- **Phone Format**: +94 XX XXX XXXX
- **Date Format**: dd/MM/yyyy
- **Language**: English

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/          # Protected dashboard pages
│   │   ├── employees/      # Employee CRUD
│   │   ├── attendance/     # Attendance marking
│   │   ├── payroll/        # Weekly payroll
│   │   ├── advances/       # Advance requests
│   │   ├── loans/          # Loan management
│   │   ├── sites/          # Work site management
│   │   ├── audit-logs/     # System audit trail
│   │   ├── reports/        # Analytics & reports
│   │   └── settings/       # System settings
│   ├── login/              # Authentication
│   ├── signup/             # Registration
│   └── forgot-password/    # Password reset
├── components/             # Reusable UI components
│   ├── ui/                 # Shadcn/Radix primitives
│   ├── dashboard/          # Dashboard-specific components
│   └── providers/          # Context providers
├── services/               # Firebase service layer
├── lib/                    # Utilities and Firebase config
├── types/                  # TypeScript type definitions
├── constants/              # App constants and config
├── store/                  # Zustand state stores
└── hooks/                  # Custom React hooks
```

## License

This project is private and proprietary.
