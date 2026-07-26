# FireMe — project knowledge (Kartikeya)

Original Scaler SDE Fullstack submission. Not affiliated with Fireflies.ai.
Implementation is original application code under `frontend/` and `backend/`.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js + TypeScript + Clerk |
| Backend | FastAPI |
| DB | SQLite locally · Postgres (Supabase) in production |
| AI | Groq (summaries, Ask, Whisper STT) |
| Hosting | Vercel + Render |

## Architecture map

- `frontend/components/Landing.tsx` — marketing surface (FireMe-branded; class prefix `fm-`)
- `frontend/components/Workspace.tsx` — meetings library + detail workspace
- `frontend/lib/api.ts` — Clerk token binding, cold-start warm, slow-request alerts
- `backend/main.py` — HTTP routes
- `backend/auth.py` — Clerk JWT verify (+ media query token)
- `backend/models.py` / `serialize.py` / `seed.py` — schema + seeding
- `backend/jobs.py` — background transcription threads
- `backend/storage.py` — durable media (disk mirror + Postgres blobs)

## Auth model

Clerk session JWTs verified via JWKS. All meetings scoped by `owner_id`.
Media endpoints accept `Authorization: Bearer` **or** `?access_token=` for native `<video>`/`<audio>` streaming.

## Processing statuses

`ready` · `awaiting_transcription` · `transcribing` · `transcription_failed`

Failures store a human-readable `processing_error` on the meeting row.

## Demo URLs

- App: https://fireme-chi.vercel.app
- API health: https://fireme.onrender.com/api/health
- Repo: https://github.com/KartikeyaM2007/fireme
