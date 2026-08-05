# Spindel Scheduler

Spindel Scheduler is a Vite + React technician scheduling app for mirroring clinic schedules from Google Sheets, validating doctor/technician constraints, and using Gemini for scheduling analysis and admin commands.

## Current Status

Recent fixes on `main` include:

- role-aware Google Sheet parsing, so `Doctor` / `Tech` sections determine whether ambiguous initials are parsed as doctors or technicians
- parser regression coverage via `pnpm run test:parser`
- safer Gemini command validation before schedule changes are applied
- Gemini panel error handling so the UI does not get stuck while analyzing or chatting
- production build polish for app metadata, font loading, and expected bundle size
- project metadata and type packages needed for local TypeScript checks
- GitHub Actions CI for parser tests, type-checking, and production builds on pushes and pull requests
- static host configs for Firebase Hosting, Netlify, and Vercel

A larger admin UI patch for AI add/remove commands and drag/edit state handling is available at `patches/spindel-app-command-dnd.patch`. It was verified locally, but is kept as a patch file so it can be applied from a normal Git checkout.

## Requirements

- Node.js 20 or newer
- pnpm 11.9.0 or newer, usually through Corepack
- Firebase project access for the configured app
- Gemini API key
- Google Sheet published to the web as CSV, or a shareable Sheet URL that can be exported as CSV

## Local Setup

```bash
git clone https://github.com/Down2pound/spindel_scheduler.git
cd spindel_scheduler
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Edit `.env.local`:

```bash
GEMINI_API_KEY="your_gemini_api_key"
APP_URL="http://localhost:3000"
```

Start the app:

```bash
pnpm run dev
```

Open the local URL printed by Vite, usually `http://localhost:3000`.

## Verification

Run these before deployment:

```bash
pnpm run test:parser
pnpm run lint
pnpm run build
```

The repository includes `pnpm-workspace.yaml` so trusted dependency build scripts can run noninteractively during install.

GitHub Actions also runs these checks automatically for pushes to `main` and for pull requests.

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
2. Check GitHub Actions for a passing CI run, or run the verification commands locally.
3. Install dependencies with `corepack enable` and `pnpm install --frozen-lockfile`.
4. Create `.env.local` with the Gemini key.
5. Run `pnpm run test:parser`.
6. Run `pnpm run lint`.
7. Run `pnpm run build`.
8. Smoke test `pnpm run dev` with Google sign-in and Sheet sync.
9. Confirm Firestore reads/writes work for admin schedule edits.
10. Deploy through the chosen host.
11. Set production environment variables in the host dashboard.
12. Add the production domain to Firebase Authentication authorized domains.

## Deployment Options

This is a static Vite app after `pnpm run build`, so any static host that serves `dist` works.

Firebase Hosting:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
corepack enable
pnpm install --frozen-lockfile
pnpm run build
firebase deploy --only hosting
```

Netlify CLI:

```bash
npm install -g netlify-cli
netlify login
corepack enable
pnpm install --frozen-lockfile
pnpm run build
netlify deploy --prod --dir=dist
```

Vercel CLI:

```bash
npm install -g vercel
vercel login
vercel --prod
```

For dashboard-based deploys, use `pnpm run build` as the build command and `dist` as the publish/output directory.

## Optional Admin Patch

Apply the prepared `src/App.tsx` patch if you want the admin command executor to support the full advertised behavior:

```bash
git apply --ignore-whitespace patches/spindel-app-command-dnd.patch
pnpm run lint
pnpm run test:parser
pnpm run build
```

The patch adds:

- `ADD` commands
- `REMOVE` commands
- day-aware AI commands
- safer immutable updates for drag/drop and edit modal changes
- audit logs for manual add/edit/delete changes
