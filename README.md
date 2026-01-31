# OKR fuer Paare

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
In `.env` set:
```
DEV_LOGIN_ENABLED="true"
```
Then you can sign in via the Developer Login form using any email.

## Key Commands
- `npm run dev` - start the app
- `npm run db:seed` - seed demo data
- `npm run test:e2e` - run Playwright tests
- `npm run lint` - lint
- `npm run format` - format with Prettier

## Seeded Demo Accounts
- `demo1@example.com`
- `demo2@example.com`

Both are attached to the demo couple and show a fully populated dashboard.

## Thinking Partner (LLM)

### 1) Import transcripts
Supported formats: `.txt`, `.md`, `.srt`, `.vtt`.

```bash
export TRANSCRIPT_DIR="/absolute/path/to/transcripts"
export RESET_TRANSCRIPTS="true"
npm run transcripts:import
```

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
