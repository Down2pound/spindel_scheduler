# Spindel Scheduler

Spindel Scheduler is a Vite + React technician scheduling app for mirroring clinic schedules from Google Sheets, validating doctor/technician constraints, and using Gemini for scheduling analysis and admin commands.

## Current Status

Recent fixes on `main` include:

- role-aware Google Sheet parsing, so `Doctor` / `Tech` sections determine whether ambiguous initials are parsed as doctors or technicians
- parser regression coverage via `npm run test:parser`
- safer Gemini command validation before schedule changes are applied
- Gemini panel error handling so the UI does not get stuck while analyzing or chatting
- production build polish for app metadata, font loading, and expected bundle size
- project metadata and type packages needed for local TypeScript checks

A larger admin UI patch for AI add/remove commands and drag/edit state handling is available at `patches/spindel-app-command-dnd.patch`. It was verified locally, but is kept as a patch file so it can be applied from a normal Git checkout.

## Requirements

- Node.js 20 or newer
- npm, pnpm, or another Node package manager
- Firebase project access for the configured app
- Gemini API key
- Google Sheet published to the web as CSV, or a shareable Sheet URL that can be exported as CSV

## Local Setup

```bash
git clone https://github.com/Down2pound/spindel_scheduler.git
cd spindel_scheduler
npm install
cp .env.example .env.local
```

Edit `.env.local`:

```bash
GEMINI_API_KEY="your_gemini_api_key"
APP_URL="http://localhost:3000"
```

Start the app:

```bash
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:3000`.

## Verification

Run these before deployment:

```bash
npm run test:parser
npm run lint
npm run build
```

If using pnpm instead of npm:

```bash
pnpm install
pnpm run test:parser
pnpm run lint
pnpm run build
```

If pnpm warns about ignored build scripts, approve trusted project dependencies or use npm for the fastest first pass.

## Google Sheet Setup

1. Open the scheduler source Google Sheet.
2. Use `File > Share > Publish to web` when CSV export is needed.
3. In the app, open settings and paste the Sheet URL.
4. Add tab GIDs for each week if the week tabs are separate sheets.
5. Use `SYNC_MIRROR` and verify each day has expected doctors, technicians, floating staff, off staff, and notes.

The parser expects each day to use three adjacent columns: location/status, start time, and end time. It also understands `Doctor`, `Doctors`, `Tech`, `Techs`, `Technician`, and `Technicians` section rows.

## Firebase Setup

The app reads `firebase-applet-config.json` and uses Google authentication plus Firestore collections for users, locations, doctors, technicians, assignments, schedules, and audit logs.

Before production deployment, confirm:

- the Firebase web app config points at the intended project
- Firestore rules match your intended admin and technician access model
- the production host has the same required environment variables as `.env.local`
- Google sign-in is enabled for the deployment domain

## Deployment Checklist

1. Pull latest `main` on the deployment machine.
2. Install dependencies.
3. Create `.env.local` with the Gemini key.
4. Run `npm run test:parser`.
5. Run `npm run lint`.
6. Run `npm run build`.
7. Smoke test `npm run dev` with Google sign-in and Sheet sync.
8. Confirm Firestore reads/writes work for admin schedule edits.
9. Deploy through the chosen host.
10. Set production environment variables in the host dashboard.

## Optional Admin Patch

Apply the prepared `src/App.tsx` patch if you want the admin command executor to support the full advertised behavior:

```bash
git apply --ignore-whitespace patches/spindel-app-command-dnd.patch
npm run lint
npm run test:parser
npm run build
```

The patch adds:

- `ADD` commands
- `REMOVE` commands
- day-aware AI commands
- safer immutable updates for drag/drop and edit modal changes
- audit logs for manual add/edit/delete changes
