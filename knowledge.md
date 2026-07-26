# FireMe knowledge base

## Purpose

FireMe is a full-stack, Fireflies-inspired meeting intelligence application created for the **Scaler SDE Fullstack Assignment - Fireflies Clone**. The product focuses on the post-meeting workflow: collecting recordings or transcripts, reviewing timestamped notes, generating AI insights, managing tasks, and exporting the result.

It is not a live-call bot. The assignment expressly allows transcription and AI summaries to be seeded, mocked, or generated from uploaded transcript files. This implementation supports manual/imported transcripts and is wired to Groq for real transcription and analysis, with OpenAI retained as an optional provider.

## Assignment requirements and current evidence

| Requirement | Current implementation | Status |
| --- | --- | --- |
| Next.js TypeScript frontend | `frontend/` Next.js 15 application | Complete |
| Python FastAPI backend | `backend/main.py` FastAPI application | Complete |
| SQLite schema designed by candidate | SQLAlchemy `Meeting`, `TranscriptSegment`, `ActionItem`, `MeetingQuestion` models | Complete locally |
| Seed several usable meetings | `seed()` creates two meetings with segments, summaries, topics, and action items | Complete |
| Meetings library with title/date/duration/participants | Library cards show all fields when available | Complete |
| Search/filter by title/date/participant | Search covers title, participants, topics, summary; UI has inclusive date-from/date-to filters | Complete |
| Sort by recency | Recent/oldest control and API sort | Complete |
| Navbar/profile/settings placeholders | Clerk sign-in/sign-up, signed-in profile menu, and backend-enforced user identity; settings page does not | Partial |
| Interactive transcript with speaker/timestamp | Segments include speaker and seconds; editable UI | Complete |
| Media player and seek bar | Uploaded audio is played with native player; segment click changes player seek position | Complete for audio; see limitations for video |
| Player/transcript sync | Player time highlights matching line; clicking line changes player time | Complete |
| Transcript search/highlight | Per-meeting search with highlighted text | Complete |
| AI summary | Seeded for samples; generated through the configured Groq/OpenAI provider | Complete; Groq live test passed |
| Action items | Persistent add/complete flow; AI can generate items | Mostly complete - edit/delete controls are API-only |
| Topics/chapters | AI-generated topics and chapters persisted to meeting | Complete; Groq live test passed |
| Create meeting by upload/paste/form | Metadata form and file import for TXT/VTT/SRT/JSON/audio/video | Complete; raw pasted transcript is not a one-step form |
| Edit meeting metadata | Title, participants, date/time form | Complete |
| Delete meeting | UI and API delete; associated rows cascade | Complete |
| Persist meetings/transcripts/summaries/actions | SQLite database and local media directory | Complete locally |
| Forms/modals/search/toasts | Implemented in the single-page UI | Complete |
| Settings placeholders | Not implemented | Missing but assignment permits placeholders |
| README with setup/architecture/schema/API/assumptions | `README.md` | Complete |
| Public GitHub repository | No Git repository or remote exists in this workspace | Missing deliverable |
| Hosted working link | No deployment exists | Missing deliverable |

## Architecture

```text
Browser (Next.js + Clerk, port 3000)
        |
        | REST API
        v
FastAPI (port 8000)
  |- SQLite: meeting metadata and related entities
  |- uploads/: locally stored recordings
  |- services.py: transcript parsers and OpenAI service calls
        |
        | only when OPENAI_API_KEY is set
        v
OpenAI Transcription API + Responses API
```

The frontend never receives AI provider secrets. Clerk's publishable key is browser-safe; its secret key stays in the ignored frontend environment file. The frontend communicates with product data only through the FastAPI API.

## Source map

| Path | Responsibility |
| --- | --- |
| `frontend/app/page.tsx` | Product landing page plus client workspace: library, import/create/edit modals, player, tabs, transcript editor, task creation, AI actions |
| `frontend/app/globals.css` | Fireflies-inspired visual styling and responsive layout |
| `frontend/app/layout.tsx`, `frontend/middleware.ts` | Clerk provider and route middleware |
| `backend/main.py` | REST endpoints, persistence workflow, import, export, AI endpoint orchestration |
| `backend/models.py` | SQLAlchemy relational model definitions |
| `backend/database.py` | SQLite engine/session dependency |
| `backend/services.py` | TXT/VTT/SRT/JSON parsing and Groq/OpenAI-compatible transcription, insights, and Q&A calls |
| `backend/.env.example` | Environment variables needed by the API |
| `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml` | Containerized launch configuration |
| `README.md` | Setup and concise architecture/API documentation |

## Data model

```text
Meeting
  id, title, occurred_at, duration_seconds, participants JSON,
  summary, topics JSON, chapters JSON, media_path, media_type,
  processing_status, created_at
  |
  +-- TranscriptSegment: id, speaker, start_seconds, content
  +-- ActionItem: id, text, owner, completed
  +-- MeetingQuestion: id, question, answer, created_at
```

Relationships:

- A meeting has many transcript segments and action items.
- Deleting a meeting cascades to transcript segments and action items.
- Questions are persisted but are not currently displayed as conversation history in the frontend.
- Participants, topics, and chapters are JSON values. This is pragmatic for this scoped, single-user assignment but not optimal for a multi-user query-heavy product.

## API endpoints

| Method | Endpoint | Behaviour |
| --- | --- | --- |
| GET | `/api/health` | API health, AI configuration state, storage mode |
| GET | `/api/meetings` | List/search/sort/filter meetings |
| POST | `/api/meetings` | Create a manual meeting |
| GET/PUT/DELETE | `/api/meetings/{id}` | Read/update/delete meeting metadata |
| POST | `/api/meetings/import` | Upload transcript or recording |
| POST | `/api/meetings/{id}/segments` | Add a transcript segment |
| PATCH/DELETE | `/api/segments/{id}` | Update/delete segment |
| POST | `/api/meetings/{id}/actions` | Add action item |
| PATCH/DELETE | `/api/actions/{id}` | Update/delete action item |
| POST | `/api/meetings/{id}/transcribe` | Send local media to the configured AI provider |
| POST | `/api/meetings/{id}/generate-insights` | Generate summary, topics, chapters, and action items via the configured AI provider |
| POST | `/api/meetings/{id}/ask` | Ask a transcript-grounded configured-provider question |
| GET | `/api/meetings/{id}/export?format=markdown|txt` | Download notes/transcript |

## Import behaviour

Supported text imports: `.txt`, `.vtt`, `.srt`, `.json`.

- Plain text parser recognizes optional `[MM:SS] Speaker: text` style lines.
- VTT/SRT parser reads cue timestamps and simple speaker labels.
- JSON parser accepts either a list or an object containing `segments`; rows use `speaker`, `start_seconds`/`start`, and `content`/`text`.

Supported media uploads: `.mp3`, `.mp4`, `.m4a`, `.wav`, `.webm`, `.ogg`, `.mpeg`, `.flac`.

Media is stored in `backend/uploads/` by default. An imported media meeting begins in `awaiting_transcription`; the user chooses **Transcribe** after configuring Groq or OpenAI.

## AI behaviour

Required variables are defined in `backend/.env.example`.

- `AI_PROVIDER=groq` uses `GROQ_SUMMARY_MODEL=llama-3.3-70b-versatile` and `GROQ_TRANSCRIBE_MODEL=whisper-large-v3-turbo` by default. Groq transcription returns timestamped segments but does not provide speaker diarization.
- `AI_PROVIDER=openai` uses `OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe-diarize` with `diarized_json` and automatic chunking, plus `OPENAI_SUMMARY_MODEL=gpt-5-mini` for analysis.
- Ask FireMe sends the meeting transcript and demands an answer grounded only in it with timestamp citations.

Without the selected provider key, non-AI flows still work. AI requests fail explicitly with HTTP 503 rather than silently faking output.

## Local runbook

### API

```powershell
cd E:\FireMe\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API health: `http://127.0.0.1:8000/api/health`  
Interactive API docs: `http://127.0.0.1:8000/docs`

### Frontend

```powershell
cd E:\FireMe\frontend
npm install
npm run dev -- --hostname localhost --port 3000
```

Application: `http://localhost:3000` (required for the Clerk development instance).

### Clerk setup

Create `frontend/.env.local` with `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. The local file is ignored by Git. Set `CLERK_ISSUER` and `CLERK_JWKS_URL` in `backend/.env`; FastAPI verifies the frontend's Clerk bearer token and scopes product records to its `sub` claim.

### AI setup

```powershell
Copy-Item E:\FireMe\backend\.env.example E:\FireMe\backend\.env
```

Set `AI_PROVIDER=groq` and `GROQ_API_KEY=...` in `backend/.env`, then restart the API. Alternatively set `AI_PROVIDER=openai` and `OPENAI_API_KEY=...`.

### Containers

```powershell
docker compose up --build
```

The Compose file includes a persistent Docker volume for SQLite and uploads. It permits `backend/.env` to be absent, so local non-AI testing still starts.

## Verification completed before this document

- Next.js production compilation succeeded with `npm run build` (run it only while the development server is stopped because both use `.next`).
- Python syntax compilation succeeded for `main.py`, `models.py`, and `services.py`.
- FastAPI smoke tests covered health, meeting creation, segment create/update/delete, action update, VTT import, export, search, date filter, plus live Groq insights and Ask FireMe requests.
- `docker compose config` validated successfully.

Live Groq summary generation and Q&A were executed successfully. Groq media transcription remains dependent on testing with a supplied recording.

## Security and production facts

- Clerk session JWTs are verified against the configured Clerk JWKS, and all product records/media are scoped to the authenticated Clerk user. Team sharing and rate limiting are not implemented.
- Local SQLite and local filesystem uploads are appropriate for a single-instance local assignment, not a horizontally-scaled or public application.
- Uploads lack enforced size limits, virus scanning, object-storage lifecycle rules, and content-security hardening.
- AI work runs synchronously in the request process. Long recordings can hold an HTTP request open.
- Do not expose `GROQ_API_KEY` or `OPENAI_API_KEY` to the frontend or commit `backend/.env`.

See [whatisleft.md](whatisleft.md) for the complete work ledger.
