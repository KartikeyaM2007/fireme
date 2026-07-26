# FireMe — Meeting Notes & Transcription Platform (Fireflies.ai Clone)

Scaler SDE Fullstack Assignment submission.

| Deliverable | Link |
| --- | --- |
| **GitHub repository** | https://github.com/KartikeyaM2007/fireme |
| **Hosted demo** | https://fireme-chi.vercel.app |
| **API** | https://fireme.onrender.com/api/health |

Public repo layout: `frontend/` + `backend/` (as required).

---

## Tech stack used

As specified by the assignment, with concrete choices:

| Layer | Technology |
| --- | --- |
| **Frontend** | Next.js (TypeScript), React, Clerk UI |
| **Backend** | Python + FastAPI (Uvicorn) |
| **Database** | SQLite by default locally; PostgreSQL (Supabase) in production via `DATABASE_URL` |
| **Auth** | Clerk session JWTs verified on the API (assignment allowed a mock logged-in user; this project uses real auth) |
| **AI (optional per brief)** | Groq LLM for summaries / Ask / transcription from transcript or media |
| **Hosting** | Frontend → Vercel · Backend → Render · DB → Supabase |

---

## Setup instructions

### Prerequisites

- Node.js 20+
- Python 3.12+
- Clerk keys (for sign-in)
- Groq API key (optional but used for live AI features)

### Backend

```powershell
cd backend
Copy-Item .env.example .env
# Fill GROQ_API_KEY, CLERK_ISSUER, CLERK_JWKS_URL, CLERK_AUTHORIZED_PARTIES
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API: http://127.0.0.1:8000 · Docs: http://127.0.0.1:8000/docs

### Frontend

```powershell
cd frontend
Copy-Item .env.example .env.local
# Fill NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
# NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
npm install
npm run dev -- --hostname localhost --port 3000
```

App: http://localhost:3000

Use `localhost` (not `127.0.0.1`) with a Clerk development instance.

### Environment (summary)

**Backend `.env`:** `DATABASE_URL` (optional), `CORS_ORIGINS`, `CLERK_ISSUER`, `CLERK_JWKS_URL`, `CLERK_AUTHORIZED_PARTIES`, `GROQ_API_KEY`, `AI_PROVIDER`, `SEED_DEMO_DATA`, `UPLOAD_DIR`

**Frontend `.env.local`:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_API_URL`

Do not commit secrets.

### Deployed environment (this submission)

- Frontend: Vercel root `frontend`, `NEXT_PUBLIC_API_URL=https://fireme.onrender.com/api`
- Backend: Render Docker, root `backend`, health `/api/health`
- `CORS_ORIGINS` / `CLERK_AUTHORIZED_PARTIES` include `https://fireme-chi.vercel.app`
- `SEED_DEMO_DATA=false` (per-user starter meetings are provisioned on first login)

---

## Architecture overview

```text
┌─────────────────────────────────────────┐
│  Next.js frontend (TypeScript)          │
│  Landing + Fireflies-style workspace    │
│  Clerk sign-in → Bearer token on APIs   │
└──────────────────┬──────────────────────┘
                   │ REST /api/*
                   ▼
┌─────────────────────────────────────────┐
│  FastAPI backend                        │
│  JWT verify → owner-scoped queries     │
│  Meetings / segments / actions / Ask    │
│  Optional Groq for insights & STT       │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
   SQLite / Postgres     Local uploads
   (SQLAlchemy)          (UPLOAD_DIR)
```

**Core UX flow:** Meetings library → open meeting → transcript + seek bar ↔ timestamps → AI summary / topics / chapters / actions → edit CRUD → optional Ask / export.

Transcription and AI summaries can be seeded or LLM-generated (per assignment). Real STT is out of scope in the brief; this repo still supports Groq transcription when media is uploaded.

---

## Database schema

Custom schema (evaluated per assignment). Designed around meetings, interactive transcripts, summaries, and action items.

### `meetings`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | Integer PK | |
| `owner_id` | String(128), indexed | Clerk user id; scopes all data |
| `title` | String(200) | |
| `occurred_at` | DateTime | Meeting date |
| `duration_seconds` | Integer | Duration |
| `participants` | Text (JSON array) | Participant names |
| `summary` | Text | AI / seeded summary |
| `topics` | Text (JSON array) | Key topics |
| `chapters` | Text (JSON array) | Outline `{title, start_seconds, summary}` |
| `media_path` | String, nullable | Uploaded recording path |
| `media_type` | String, nullable | MIME type |
| `processing_status` | String | e.g. `ready`, `awaiting_transcription` |
| `created_at` | DateTime | |

### `transcript_segments`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | Integer PK | |
| `meeting_id` | FK → `meetings.id` | Cascade delete |
| `speaker` | String | Speaker label |
| `start_seconds` | Integer | Timestamp for seek sync |
| `content` | Text | Spoken text |

### `action_items`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | Integer PK | |
| `meeting_id` | FK → `meetings.id` | Cascade delete |
| `text` | Text | Task text |
| `owner` | String | Assignee |
| `completed` | Boolean | Complete toggle |

### `meeting_questions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | Integer PK | |
| `meeting_id` | FK → `meetings.id` | Cascade delete |
| `question` | Text | Ask FireMe question |
| `answer` | Text | Model answer |
| `created_at` | DateTime | |

**Relationships:** one `Meeting` has many segments, actions, and questions.  
**Sample data:** each signed-in user is seeded with several meetings that include full transcripts, summaries, topics, chapters, and action items so the app is immediately usable.

---

## API overview

Base path prefix: `/api`  
Auth: `Authorization: Bearer <Clerk JWT>` on all routes except health.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health / DB / AI status |
| `GET` | `/api/meetings` | List; `query`, `participant`, `date_from`, `date_to`, `sort` |
| `POST` | `/api/meetings` | Create meeting (form) |
| `GET` | `/api/meetings/{id}` | Detail with segments + actions |
| `PUT` | `/api/meetings/{id}` | Edit metadata (title, participants, …) |
| `DELETE` | `/api/meetings/{id}` | Delete meeting |
| `POST` | `/api/meetings/import` | Upload transcript or recording |
| `POST` | `/api/meetings/{id}/paste-transcript` | Paste transcript text |
| `POST` | `/api/meetings/{id}/segments` | Add transcript line |
| `PATCH`/`DELETE` | `/api/segments/{id}` | Edit / delete segment |
| `POST` | `/api/meetings/{id}/actions` | Add action item |
| `PATCH`/`DELETE` | `/api/actions/{id}` | Edit / complete / delete action |
| `POST` | `/api/meetings/{id}/generate-insights` | AI summary, topics, chapters, actions |
| `POST` | `/api/meetings/{id}/transcribe` | Transcribe uploaded media |
| `POST` | `/api/meetings/{id}/ask` | Ask a question about this meeting |
| `GET` | `/api/meetings/{id}/media` | Stream recording |
| `GET` | `/api/meetings/{id}/export` | Export `markdown` / `txt` / `pdf` |

Interactive OpenAPI docs: `/docs`.

---

## Assumptions made

1. **Scope:** Focus is the Fireflies **post-meeting** workspace (library + transcript + summary), not live call bots.
2. **STT:** Assignment marks real speech-to-text as out of scope / placeholder-OK. Seeded transcripts and file upload (`.txt` / `.vtt` / `.json` / etc.) satisfy the core path; Groq transcription is an optional enhancement when media is present.
3. **AI summaries:** May be seeded or LLM-generated from transcript text (both supported).
4. **Auth:** Brief allows assuming a default logged-in user. This submission uses Clerk so the hosted multi-user demo stays private per account.
5. **Media player:** Audio/video may be a placeholder; starter meetings use a seek bar that stays synced with transcript timestamps even without a file.
6. **Placeholders:** Live bot, calendar/CRM integrations, and team sharing are exposed as **Settings → Coming soon**.
7. **Database:** Assignment asks for SQLite schema design; SQLite works locally. Production uses the same schema on PostgreSQL through `DATABASE_URL`.
8. **JSON columns:** `participants`, `topics`, and `chapters` are stored as JSON text for simple portable schema across SQLite and Postgres.

---

## Core features implemented (Must Have)

1. **Meetings library / dashboard** — list with title, date, duration, participants; search; filter by date/participant; sort by recency; profile + Settings placeholder  
2. **Meeting / transcript detail** — speaker labels, timestamps, seek bar, click-to-seek both ways, in-transcript search with highlights  
3. **AI summary & notes** — summary, action items, topics, chapters  
4. **CRUD** — create (form / upload / paste), edit metadata, delete, add/edit/complete actions; all persist  
5. **Fireflies experience** — library + detail layout, transcript/summary panels, forms/modals/search/filters, toasts, Settings placeholder  

### Bonus features included

- Export PDF / Markdown / TXT  
- Global search across meetings (including transcript text)  
- Topics on meetings **with dedicated topic filter**  
- LLM “Ask FireMe” about a meeting  
- Comments / highlights / soundbites on transcript segments  
- Dark mode toggle  
- Durable media storage (Postgres `media_blobs`, optional Supabase Storage)  
- Background transcription jobs (non-blocking HTTP)  

---

## Project structure

```text
fireme/
  frontend/
    app/                 Next.js entry (page, layout, styles)
    components/          Landing + Workspace modules
    lib/                 API client, types, format helpers
  backend/
    main.py              FastAPI app + routes
    auth.py / schemas.py / serialize.py / seed.py / exports.py
    storage.py           Durable uploads (Postgres / Supabase)
    jobs.py              Background transcription
    models.py / services.py
  README.md
```

## Original work

This repository is an original implementation for the Scaler assignment. It is not a fork of an existing Fireflies clone and is not affiliated with Fireflies.ai.

