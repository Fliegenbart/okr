# OKR für Paare

Production-ready MVP PWA for couples to track quarterly objectives and key results.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Prisma + PostgreSQL (Docker)
- NextAuth (Email magic link + Dev Login)
- Recharts + framer-motion
- Playwright

## Setup

### 1) Install dependencies

```bash
npm install
```

### 2) Start Postgres

```bash
docker compose up -d
```

### 3) Environment

Copy `.env.example` to `.env` and adjust if needed:

```bash
cp .env.example .env
```

### 4) Migrate + seed

```bash
npx prisma migrate dev
npm run db:seed
```

### 5) Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Dev Login

Only for local development, in `.env` set:

```
DEV_LOGIN_ENABLED="true"
```

Then you can sign in via the Developer Login form using any email.
Do not enable this in production.

## Closed Beta Auth MVP

For a production-style MVP with 10-20 couples:

```bash
BETA_MODE="closed"
ALLOW_SELF_SERVE_SIGNUP="false"
DEV_LOGIN_ENABLED="false"
```

Use a real SMTP-capable provider for `EMAIL_*`, set `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to your production domain, and create access for Person 1 manually:

```bash
npm run beta:invite -- person1@example.com "Couple 01"
```

Flow:

- Person 1 signs in via `/auth/signin` using the invited email.
- Person 1 creates the couple in onboarding.
- Person 2 joins via the existing couple invite flow.

## Vercel Deploy

The app now expects Prisma migrations to be applied during the build. On Vercel, make sure these environment variables exist in the target environment:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`

For closed beta and magic-link emails also set:

- `BETA_MODE`
- `ALLOW_SELF_SERVE_SIGNUP`
- `DEV_LOGIN_ENABLED`
- `ADMIN_EMAILS`
- `SUPPORT_ACCESS_CODE`
- `SUPPORT_ACCESS_EMAILS` (optional fallback allowlist)
- `EMAIL_SERVER_HOST`
- `EMAIL_SERVER_PORT`
- `EMAIL_SERVER_USER`
- `EMAIL_SERVER_PASSWORD`
- `EMAIL_FROM`

For a private beta with 10 couples, use the admin page at `/admin/beta` to
bulk add the allowed participant emails. Those users can sign in on
`/auth/signin` with their E-Mail plus `SUPPORT_ACCESS_CODE`, even if SMTP is
not configured. Admins can use the same page or the hardcoded `ADMIN_EMAILS`
allowlist.

If the Board page shows a setup error, the production database is still missing the latest Prisma migrations.

## Key Commands

- `npm run dev` - start the app
- `npm run db:seed` - seed demo data
- `npm run beta:invite -- <email>` - whitelist Person 1 for the closed beta
- `npm run test:e2e` - run Playwright tests
- `npm run lint` - lint
- `npm run format` - format with Prettier

## Seeded Demo Accounts

- `demo1@example.com`
- `demo2@example.com`

Both are attached to the demo couple and show a fully populated dashboard.
The demo couple is only available on databases where `npm run db:seed` has
already been executed.

## Thinking Partner (LLM)

### 1) Import transcripts

Supported formats: `.txt`, `.md`, `.srt`, `.vtt`.

```bash
export TRANSCRIPT_DIR="/absolute/path/to/transcripts"
export RESET_TRANSCRIPTS="true"
export TRANSCRIPT_COUPLE_ID=""
npm run transcripts:import
```

If `TRANSCRIPT_COUPLE_ID` is set, the imported knowledge is scoped to that couple. If it is empty, the transcripts stay global and are only used when the app intentionally allows shared knowledge.

### 2) Configure LLM

Add to `.env`:

```
OPENAI_API_KEY="your-key"
OPENAI_MODEL="gpt-4.1"
OPENAI_FALLBACK_MODEL="gpt-4.1-mini"
```

Open `http://localhost:3000/dashboard/thinking-partner`.

## Weekly Check-in (Calendar)

In `http://localhost:3000/dashboard/settings` you can configure a weekly check-in and:

- open a Google Calendar template
- download an `.ics` file for Apple/Outlook

## Where to edit German UI copy

- Pages: `src/app`
- Dashboard components: `src/components/dashboard`
- Shared UI: `src/components/ui`

## Notes

- Invite emails are only sent if real SMTP credentials are configured.
- PWA assets live in `public/` and `public/manifest.json`.
- The admin console lives under `/admin` and is only accessible to users whose email is listed in `ADMIN_EMAILS` or who have `role = ADMIN` in the database.
