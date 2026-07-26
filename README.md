# FireMe — Fireflies.ai Clone (Scaler SDE Fullstack Assignment)

FireMe is a full-stack meeting intelligence workspace inspired by [Fireflies.ai](https://fireflies.ai). It recreates the core post-meeting workflow: meeting library, interactive transcript with seek sync, AI summary / topics / chapters / action items, CRUD, search/filters, and a Fireflies-style notepad UI.

## Live demo & repository

| Item | Link |
| --- | --- |
| **Hosted app** | https://fireme-chi.vercel.app |
| **API health** | https://fireme.onrender.com/api/health |
| **GitHub** | https://github.com/KartikeyaM2007/fireme |

Sign in with Clerk on the hosted app. Each new user receives private seeded starter meetings (full transcripts, summaries, topics, chapters, and action items).

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Clerk (`@clerk/nextjs`) |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Pydantic, Uvicorn |
| Database | SQLite locally by default; PostgreSQL (Supabase) in production via `DATABASE_URL` |
| Auth | Clerk session JWTs verified on the API with JWKS |
| AI | Groq (default) or OpenAI-compatible APIs for summary, Ask, and transcription |
| Export | Markdown, plain text, PDF (`fpdf2`) |
| Hosting | Frontend on Vercel, backend on Render (Docker), DB on Supabase |

Repo layout matches the assignment: `frontend/` and `backend/`.

## Features (assignment coverage)

### Core (Must Have)

1. **Meetings library / dashboard** — title, date, duration, participants; search; filter by date and participant; sort by recency; profile menu + Settings placeholder
2. **Meeting / transcript detail** — speaker labels, timestamps, highlighted in-transcript search, media or placeholder seek bar; transcript click ↔ player seek sync
3. **AI summary & notes** — summary, action items, key topics, chapters (LLM-generated and/or seeded)
4. **Meeting management (CRUD)** — create (form / import / paste), edit metadata, delete, add/edit/complete actions; all data persists
5. **Fireflies experience** — library + detail layout, summary/transcript/Ask panels, modals, search/filters, toasts, Settings Coming soon

### Bonus (implemented)

- Global search across titles, people, topics, summaries, and transcript text
- Export to Markdown / TXT / PDF
- LLM “Ask FireMe” grounded in the meeting transcript
- Topics shown on meetings (filterable via search)

### Out of scope / placeholders (per brief)

- Live meeting bot, calendar, Zoom/Meet integrations, team sharing → **Settings → Coming soon**

## Architecture overview

```text
Browser (Vercel / localhost:3000)
  Clerk sign-in → session JWT
        │  REST + Authorization: Bearer <token>
        ▼
FastAPI (Render / localhost:8000)
  ├─ Verify Clerk JWT (issuer + JWKS + authorized party)
  ├─ Scope every meeting row by owner_id = Clerk sub
  ├─ SQLite or PostgreSQL (SQLAlchemy)
  ├─ Local file uploads (UPLOAD_DIR)
  └─ Groq / OpenAI for insights, Ask, transcription
```

**Data flow (typical):** Import or paste transcript / upload recording → (optional) transcribe → generate insights → review summary/actions → ask questions → export.

## Database schema

Designed for the assignment’s meeting/transcript/action workflows:

```text
meetings
  id                  INTEGER PK
  owner_id            VARCHAR(128) NULL  -- Clerk user id (sub); indexed
  title               VARCHAR(200)
  occurred_at         DATETIME
  duration_seconds    INTEGER
  participants        TEXT                 -- JSON string array
  summary             TEXT
  topics              TEXT                 -- JSON string array
  chapters            TEXT                 -- JSON [{title, start_seconds, summary}]
  media_path          VARCHAR(500) NULL
  media_type          VARCHAR(100) NULL
  processing_status   VARCHAR(40)          -- ready | awaiting_transcript | ...
  created_at          DATETIME

transcript_segments
  id                  INTEGER PK
  meeting_id          INTEGER FK → meetings.id  (cascade delete)
  speaker             VARCHAR(100)
  start_seconds       INTEGER
  content             TEXT

action_items
  id                  INTEGER PK
  meeting_id          INTEGER FK → meetings.id  (cascade delete)
  text                TEXT
  owner               VARCHAR(100)
  completed           BOOLEAN

meeting_questions
  id                  INTEGER PK
  meeting_id          INTEGER FK → meetings.id  (cascade delete)
  question            TEXT
  answer              TEXT
  created_at          DATETIME
```

**Relationships:** `Meeting` 1—* `TranscriptSegment`, `ActionItem`, `MeetingQuestion`.  
**Auth isolation:** list/get/update/delete always filter on `meetings.owner_id`.

## API overview

Base URL (local): `http://127.0.0.1:8000`  
Base URL (prod): `https://fireme.onrender.com`  
Interactive docs: `/docs`

All meeting routes require `Authorization: Bearer <Clerk session JWT>` except `GET /api/health`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness; DB + AI provider status |
| `GET` | `/api/meetings` | List/search (`query`), filter (`participant`, `date_from`, `date_to`), sort (`recent`/`oldest`) |
| `POST` | `/api/meetings` | Create meeting |
| `GET` | `/api/meetings/{id}` | Meeting detail (segments + actions) |
| `PUT` | `/api/meetings/{id}` | Edit meeting metadata |
| `DELETE` | `/api/meetings/{id}` | Delete meeting and children |
| `POST` | `/api/meetings/import` | Import `.txt/.vtt/.srt/.json` or audio/video |
| `POST` | `/api/meetings/{id}/paste-transcript` | Paste transcript text |
| `POST` | `/api/meetings/{id}/segments` | Add transcript line |
| `PATCH` / `DELETE` | `/api/segments/{id}` | Edit/delete segment |
| `POST` | `/api/meetings/{id}/actions` | Add action item |
| `PATCH` / `DELETE` | `/api/actions/{id}` | Edit/complete/delete action |
| `POST` | `/api/meetings/{id}/generate-insights` | AI summary, topics, chapters, actions |
| `POST` | `/api/meetings/{id}/transcribe` | Transcribe uploaded media |
| `POST` | `/api/meetings/{id}/ask` | Ask a question about this meeting |
| `GET` | `/api/meetings/{id}/media` | Stream recording |
| `GET` | `/api/meetings/{id}/export?format=` | `markdown` \| `txt` \| `pdf` |

## Setup instructions

### Prerequisites

- Node.js 20+
- Python 3.12+
- Clerk application (publishable + secret keys; issuer + JWKS URL)
- Groq API key (or OpenAI if you switch provider)

### 1. Backend

```powershell
cd backend
Copy-Item .env.example .env
# Edit .env: GROQ_API_KEY, CLERK_ISSUER, CLERK_JWKS_URL, CLERK_AUTHORIZED_PARTIES
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Optional: set `DATABASE_URL` to a Postgres URL (Supabase session pooler recommended). Without it, SQLite is used.

### 2. Frontend

```powershell
cd frontend
Copy-Item .env.example .env.local
# Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
# NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
npm install
npm run dev -- --hostname localhost --port 3000
```

Open [http://localhost:3000](http://localhost:3000). API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

Use `localhost` (not `127.0.0.1`) for the frontend when using a Clerk development instance.

> Do not run `npm run build` while `next dev` is running — both use `.next`.

### 3. Tests

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pytest -q

cd ..\frontend
npm test
```

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `groq` when Groq key exists | `groq` or `openai` |
| `GROQ_API_KEY` | — | Groq API key |
| `GROQ_SUMMARY_MODEL` | `llama-3.3-70b-versatile` | Summary / Ask model |
| `GROQ_TRANSCRIBE_MODEL` | `whisper-large-v3-turbo` | Transcription model |
| `OPENAI_API_KEY` | — | Required only for OpenAI provider |
| `OPENAI_SUMMARY_MODEL` | `gpt-5-mini` | OpenAI summary / Ask model |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-transcribe-diarize` | OpenAI transcription model |
| `DATABASE_URL` | SQLite file | SQLAlchemy URL (use Supabase pooler in prod) |
| `CORS_ORIGINS` | localhost + 127.0.0.1 | Comma-separated browser origins |
| `CLERK_ISSUER` | — | Clerk issuer URL |
| `CLERK_JWKS_URL` | — | Clerk JWKS URL |
| `CLERK_AUTHORIZED_PARTIES` | `http://localhost:3000` | Allowed JWT `azp` values |
| `SEED_DEMO_DATA` | `true` | Legacy unowned seed; use `false` in production |
| `UPLOAD_DIR` | `./uploads` | Recording storage path |

### Frontend (`frontend/.env.local`)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key (server only) |
| `NEXT_PUBLIC_API_URL` | API base including `/api` |

Never commit `.env` / `.env.local` or put provider secrets in `NEXT_PUBLIC_*` variables.

## Deployment (Render + Vercel)

### Backend (Render Web Service)

- Root Directory: `backend`
- Runtime: Docker
- Health Check Path: `/api/health`
- Env: `DATABASE_URL`, `GROQ_API_KEY`, `AI_PROVIDER`, `CLERK_ISSUER`, `CLERK_JWKS_URL`, `CLERK_AUTHORIZED_PARTIES`, `CORS_ORIGINS`, `SEED_DEMO_DATA=false`
- Optional disk: mount `/data`, set `UPLOAD_DIR=/data/uploads`

Production CORS / Clerk parties for this project:

```text
CORS_ORIGINS=https://fireme-chi.vercel.app,http://localhost:3000,http://127.0.0.1:3000
CLERK_AUTHORIZED_PARTIES=https://fireme-chi.vercel.app,http://localhost:3000
```

### Frontend (Vercel)

- Root Directory: `frontend`
- Env: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_API_URL=https://fireme.onrender.com/api`
- Add the Vercel URL in Clerk allowed origins / redirect URLs

## AI providers

| Capability | Groq default | Notes |
| --- | --- | --- |
| Summary / Ask FireMe | `llama-3.3-70b-versatile` | Structured notes + transcript-grounded answers |
| Transcription | `whisper-large-v3-turbo` | Timestamped segments; no speaker diarization |
| Alternative | OpenAI | Set `AI_PROVIDER=openai` and OpenAI keys/models |

## Assumptions

- The brief prioritizes the **post-meeting** Fireflies experience, not live bots or CRM integrations (those stay as Coming soon).
- Real STT is optional in the PDF; this project still implements Groq transcription for uploaded media.
- Auth is optional in the brief (“assume a logged-in user”); this project uses real Clerk auth and per-user isolation.
- With `SEED_DEMO_DATA=false`, each signed-in user is provisioned private starter meetings so the hosted demo is immediately usable.
- Starter meetings may have no recording file; a **placeholder seek bar** still satisfies transcript ↔ player sync for evaluation.
- `participants`, `topics`, and `chapters` are stored as JSON text for simple schema evolution on SQLite/Postgres without migrations tooling.
- Free Render instances cold-start; the first API request after idle may take ~30s.

## Project structure

```text
fireme/
  frontend/          Next.js app (landing + workspace)
  backend/           FastAPI app, models, services, tests
  README.md          This file
  docker-compose.yml Optional local compose
```

## License / originality

Built for the Scaler SDE Fullstack Assignment (Fireflies.ai clone). Not affiliated with Fireflies.ai.
