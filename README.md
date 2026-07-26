# FireMe — Meeting intelligence workspace

FireMe is a full-stack, Fireflies-inspired meeting intelligence app. It pairs an original animated product landing page with a persistent meeting workspace for imported recordings and transcripts.

## What works

- Scroll-animated product landing page at `/`, with a working **Open workspace** handoff
- Persistent PostgreSQL (or SQLite) meeting library: create, edit, delete, search, sort, and filter by date or participant
- Transcript import for `.txt`, `.vtt`, `.srt`, and `.json`
- Recording import for `.mp3`, `.mp4`, `.m4a`, `.wav`, `.webm`, `.ogg`, `.mpeg`, and `.flac`
- Native audio/video playback **or** a placeholder seek bar that stays synced with transcript timestamps
- Transcript search with highlighted matches, editable lines, and pasted-transcript import
- AI summaries, topics, chapters, action extraction, and transcript-grounded Ask FireMe answers
- Groq-powered transcription with `whisper-large-v3-turbo`
- Markdown, text, and PDF exports
- Global search across titles, participants, topics, summaries, and transcript text
- Clerk sign-in/sign-up controls, signed-in profile menu, Settings placeholder, and workspace handoff
- Per-user seeded starter meetings with full transcripts, summaries, topics, chapters, and actions

## AI providers

Groq is the active local provider. It is configured through `backend/.env`, which is ignored by Git.

| Capability | Groq default | Notes |
| --- | --- | --- |
| Summary / Ask FireMe | `llama-3.3-70b-versatile` | Generates structured notes and transcript-grounded answers |
| Transcription | `whisper-large-v3-turbo` | Returns timestamped segments; speaker diarization is not provided by this model |
| Alternative | OpenAI | Supported by setting `AI_PROVIDER=openai` and the OpenAI variables |

Never put provider keys in frontend environment variables or commit `backend/.env`.

## Local development

Use two terminals.

```powershell
cd E:\FireMe\backend
Copy-Item .env.example .env
# Set GROQ_API_KEY in .env (or configure OpenAI instead)
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

```powershell
cd E:\FireMe\frontend
npm install
npm run dev -- --hostname localhost --port 3000
```

Open [http://localhost:3000](http://localhost:3000). The FastAPI docs are at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

`CORS_ORIGINS` includes both `localhost:3000` and `127.0.0.1:3000` for local development. Keep the frontend and API hostnames aligned when deploying.

> Do not run `npm run build` while the Next development server is running: both use `.next`, and a concurrent build can invalidate the dev server's generated CSS. Stop the dev server first, build, then start it again.

## Deployment (Render + Vercel)

Deploy the backend as a Render **Web Service**:

- Root Directory: `backend`
- Runtime: Docker
- Health Check Path: `/api/health`
- Environment: `DATABASE_URL`, `GROQ_API_KEY`, `AI_PROVIDER`, `CLERK_ISSUER`, `CLERK_JWKS_URL`, `CLERK_AUTHORIZED_PARTIES`, `CORS_ORIGINS`, and `SEED_DEMO_DATA=false`
- Mount a persistent disk at `/data` and set `UPLOAD_DIR=/data/uploads` if recordings must survive restarts

Deploy the frontend on Vercel with Root Directory `frontend`. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `NEXT_PUBLIC_API_URL=https://<render-service>/api`. Add the Vercel origin to both `CORS_ORIGINS` and `CLERK_AUTHORIZED_PARTIES` on Render and to the allowed origins/redirect URLs in Clerk.

## Authentication

Clerk is configured in `frontend/.env.local`, which is ignored by Git. Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` there before starting the frontend. For a Clerk development instance, use `http://localhost:3000` rather than `127.0.0.1:3000`.

Signed-out visitors see **Sign in**, **Get started**, and **Create your account**. Signed-in users see **Open workspace** and the Clerk profile menu. The frontend attaches the Clerk session token to API requests; FastAPI validates it against the Clerk JWKS and scopes every meeting, transcript, action, export, AI request, and media file to its Clerk user id.

Set `CLERK_ISSUER` and `CLERK_JWKS_URL` in `backend/.env`. They are included for the configured development instance; use the values for your own Clerk instance in deployment.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | `groq` when `GROQ_API_KEY` exists | `groq` or `openai` |
| `GROQ_API_KEY` | — | Required for Groq AI operations |
| `GROQ_SUMMARY_MODEL` | `llama-3.3-70b-versatile` | Groq summary and Q&A model |
| `GROQ_TRANSCRIBE_MODEL` | `whisper-large-v3-turbo` | Groq transcription model |
| `OPENAI_API_KEY` | — | Required only when `AI_PROVIDER=openai` |
| `OPENAI_SUMMARY_MODEL` | `gpt-5-mini` | OpenAI summary and Q&A model |
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-transcribe-diarize` | OpenAI diarized transcription model |
| `DATABASE_URL` | local SQLite | SQLAlchemy URL; use the Supabase session pooler for deployment |
| `CORS_ORIGINS` | local `localhost` + `127.0.0.1` origins | Allowed browser origins |
| `CLERK_AUTHORIZED_PARTIES` | `http://localhost:3000` | Trusted Clerk token origins |
| `SEED_DEMO_DATA` | `true` | Set `false` in production to avoid legacy unowned demo rows |
| `UPLOAD_DIR` | `./uploads` | Local recording storage |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000/api` | Browser-visible backend API URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | â€” | Frontend Clerk publishable key in `frontend/.env.local` |
| `CLERK_SECRET_KEY` | â€” | Server-side Clerk key in `frontend/.env.local`; never commit it |

## Architecture

```text
Next.js frontend (Vercel / localhost:3000)
        │ REST + Clerk Bearer token
        ▼
FastAPI API (Render / localhost:8000)
  ├─ PostgreSQL (Supabase) or SQLite: meetings, segments, actions, questions
  ├─ Local upload storage (`UPLOAD_DIR`)
  └─ Groq or OpenAI-compatible provider calls
```

The frontend never receives AI provider secrets.

## Database schema

```text
meetings
  id, owner_id, title, occurred_at, duration_seconds,
  participants (JSON text), summary, topics (JSON text), chapters (JSON text),
  media_path, media_type, processing_status, created_at

transcript_segments
  id, meeting_id → meetings.id, speaker, start_seconds, content

action_items
  id, meeting_id → meetings.id, text, owner, completed

meeting_questions
  id, meeting_id → meetings.id, question, answer, created_at
```

Relationships: one meeting has many segments, actions, and Ask FireMe question rows. All product rows are scoped by `meetings.owner_id` (Clerk `sub`).

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Health, selected provider, and AI configuration status |
| `GET` | `/api/meetings` | Search, participant/date filter, sort, and list meetings |
| `POST` | `/api/meetings` | Create a manual meeting |
| `GET/PUT/DELETE` | `/api/meetings/{id}` | Read, edit, or delete a meeting |
| `POST` | `/api/meetings/import` | Import transcript or media files |
| `POST` | `/api/meetings/{id}/paste-transcript` | Paste transcript text into a meeting |
| `POST` | `/api/meetings/{id}/transcribe` | Transcribe an uploaded recording |
| `POST` | `/api/meetings/{id}/generate-insights` | Generate summary, topics, chapters, and actions |
| `POST` | `/api/meetings/{id}/ask` | Answer a question from the meeting transcript |
| `POST` | `/api/meetings/{id}/segments` | Add a transcript segment |
| `PATCH/DELETE` | `/api/segments/{id}` | Update or delete a segment |
| `POST` | `/api/meetings/{id}/actions` | Add an action item |
| `PATCH/DELETE` | `/api/actions/{id}` | Update or delete an action item |
| `GET` | `/api/meetings/{id}/media` | Stream an uploaded recording |
| `GET` | `/api/meetings/{id}/export` | Download Markdown, text, or PDF export |

## Assumptions

- Assignment focus is the post-meeting Fireflies workflow; live meeting bots and calendar/CRM integrations are Settings placeholders.
- Real speech-to-text is optional in the brief; this repo implements Groq transcription when a recording is uploaded.
- Seeded starter meetings are provisioned per signed-in user so the hosted demo is immediately usable with `SEED_DEMO_DATA=false`.
- Audio/video may be missing on starter rows; the placeholder seek bar still supports transcript sync for evaluation.

## Verification status

- Frontend production build / TypeScript checks and Vitest workspace coverage.
- Backend pytest coverage for auth isolation, global transcript search, and PDF export.
- Hosted demo: frontend on Vercel, API on Render, Supabase PostgreSQL, Clerk auth.
- Browser CORS verified for `https://fireme-chi.vercel.app` → `https://fireme.onrender.com`.

## Production boundaries

This is an assignment implementation with Clerk-authenticated, user-scoped API data and SQLite/PostgreSQL support. A public multi-user deployment still needs team/workspace sharing, object storage, background jobs for long media, upload limits/scanning, rate limiting, monitoring, and provider retry handling.
