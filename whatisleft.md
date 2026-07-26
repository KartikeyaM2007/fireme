# FireMe status vs Scaler assignment

**Author:** Kartikeya · Updated for submission readiness.

## Verdict

Must-have features and listed bonuses are implemented in code and on the hosted demo.
Remaining work is polish, demo hygiene, and interview readiness — not missing CRUD.

## Intentionally out of scope (PDF allows Coming Soon)

- Live meeting bot joining Zoom / Meet / Teams
- Calendar / CRM integrations
- Team sharing & collaboration channels
- Conversation intelligence (talk-time, sentiment)

These are exposed as **Settings → Coming soon**.

## Known ops notes (documented for evaluators)

1. **Render free tier cold starts** — first API call after idle can take 30–60s. The workspace shows a wake-up banner; warm `/api/health` on open.
2. **Large video playback** — media streams via authenticated `access_token` query (HTML media cannot send Bearer headers). Re-open the meeting if a token expires mid-play.
3. **Transcription failures** — status becomes `transcription_failed` with `processing_error` text (no silent hang on `awaiting_transcription`).

## Do not treat as gaps

- Real Clerk auth (beyond the PDF’s “default user” allowance)
- Groq STT + ffmpeg compress (beyond the PDF’s “STT out of scope”)
- Durable Postgres `media_blobs`

## Clean-up checklist before a live review

- [ ] Delete personal E2E junk meetings from the demo account
- [ ] Hard-refresh Vercel after deploy
- [ ] Click Ask / Generate once after waking the API
