# What is left - complete, honest work ledger

This is intentionally not a marketing list. Every item below is either required to finish a deliverable, incomplete versus the assignment, unverified, or necessary for a production-quality application.

## Blocking final assignment deliverables

- [ ] Create a Git repository, commit source, add an appropriate `.gitignore`, create a **public GitHub repository**, and push it. The assignment explicitly requires this.
- [ ] Deploy the frontend and backend and submit a hosted working URL. The assignment explicitly requires this.
- [ ] Run a real Groq transcription against a representative uploaded recording. Live Groq summary generation, action extraction, and Ask FireMe have already passed.
- [ ] Record a short demo/validation pass after deployment: import transcript, import recording, transcribe, generate insights, edit a transcript line, create/complete task, export notes, reload to prove persistence.

## Core assignment gaps and partials

### Meetings library

- [x] Add a date-to filter: the library now supports an inclusive date range.
- [ ] Improve empty/loading/error states in the library. A failure shows a temporary toast but not a durable recovery screen.
- [ ] Add real profile/settings placeholder destination if strict interpretation of the navbar/settings placeholder requirement is wanted. The old decorative navigation was deliberately removed rather than left as dead UI.

### Meeting detail / transcript

- [x] Add a proper native video player for video uploads.
- [ ] Extract and persist actual media duration on upload/transcription. Duration currently derives from text timestamps or browser player metadata for the open session.
- [ ] Improve transcript/player sync while audio is playing. Current segment highlight assumes a 30-second window rather than calculating a segment end from the next timestamp.
- [x] Add a one-step **paste transcript** form with timestamp/speaker parsing.
- [x] Add edit and delete UI controls for action-item text and owner.
- [ ] Add edit UI for summary, topics, and chapters if users must manually correct AI notes.
- [ ] Show persisted Ask FireMe conversation history. Questions and answers are saved in `meeting_questions` but only the immediate current answer is visible.

### AI/transcription

- [ ] Add provider health/error detail and provider selection UI if multiple AI providers need to be selectable by end users. Groq is configured server-side today; OpenAI remains an environment-level alternative.
- [ ] Add background jobs/queue and status polling. Transcription and AI calls presently execute inside an HTTP request, which is unsafe for long recordings and can time out under deployment.
- [ ] Add retry/error state and retry UX for provider, network, rate-limit, invalid-media, and malformed-model-output failures.
- [ ] Replace regex JSON extraction with OpenAI Structured Outputs/JSON Schema validation. The current approach is defensively parsed but not strict enough for production.
- [ ] Add user-selected language, known-speaker naming, and robust speaker-name editing after diarization.
- [ ] Add transcript chunking/token-budget strategy for very long transcript summaries and Ask FireMe. Sending an arbitrarily long whole transcript will eventually hit model limits/costs.
- [ ] Add AI output evaluation fixtures before relying on generated tasks and summaries.

## Production engineering missing

### Authentication, access, and collaboration

- [x] Add Clerk sign-in/sign-up controls and signed-in profile menu to the frontend.
- [x] Validate Clerk JWTs in FastAPI and require an authenticated user for every meeting, transcript, action, upload, export, AI, and media endpoint.
- [ ] Add user, workspace/team, membership, and ownership tables.
- [ ] Enforce authorization on every meeting, transcript, action, upload, export, and AI endpoint.
- [ ] Implement share links, permissions, and revocation if Share is offered.
- [ ] Add audit logging and privacy/retention controls for uploaded meeting recordings.

### Database and storage

- [ ] Move from SQLite to PostgreSQL for a deployed multi-user app.
- [ ] Add Alembic migrations. Existing SQLite schema evolution uses a small additive helper, not a migration history.
- [ ] Normalize participants/tags/topics if filtering, permissions, analytics, and user identities become real features.
- [ ] Move media from local disk to S3/Cloudflare R2/GCS with signed upload/download URLs.
- [ ] Add upload size limits, MIME verification, virus/malware scanning, retention/deletion jobs, and storage quotas.
- [ ] Separate development seed data from production startup. Current startup seeds when the database is empty.

### Security and reliability

- [ ] Put secrets in hosted secret management; never commit `.env`.
- [ ] Add request validation limits, API rate limits, CSRF/cookie policy if browser auth is added, secure headers, and logging with request IDs.
- [ ] Restrict CORS to the final deployed web origin.
- [ ] Add centralized error reporting and health/readiness monitoring.
- [ ] Add backups and restore tests for database and media.
- [ ] Make AI jobs idempotent to avoid duplicate action items on retries.

### Testing and code quality

- [x] Add a committed automated backend test suite for pasted transcript parsing, authentication rejection, user isolation, and action lifecycle.
- [ ] Expand backend tests to cover media error paths, exports, migration upgrades, and Groq/OpenAI provider adapters.
- [ ] Add frontend component/integration tests for forms, error handling, tabs, filter/search, playback seeking, and editable rows.
- [ ] Add end-to-end Playwright tests against local services.
- [ ] Reformat/split `frontend/app/page.tsx`. It is a single dense client component and needs components/hooks/API client modules for maintainability.
- [ ] Replace browser `window.confirm` with accessible app modals.
- [ ] Run an accessibility review: keyboard navigation, focus trapping in modals, labels, contrast, screen reader announcements, and responsive/mobile validation.
- [ ] Audit and update frontend dependencies. The earlier build reported a vulnerable Next.js version; pin a current patched version and retest.

## Assignment-permitted placeholders that remain intentionally out of scope

These are not required for a passing assignment because the brief explicitly permits placeholders, but they are absent:

- [ ] Real-time bot that joins Zoom/Google Meet/Teams calls
- [ ] Calendar/Zoom/Google Meet/CRM integrations
- [ ] Team collaboration and real sharing
- [x] Frontend sign-in/sign-up identity controls (Clerk); backend authorization remains a separate requirement.

If you decide to implement them, they are separate products/features with OAuth, webhooks, privacy/consent, and often a dedicated meeting-bot provider.

## Optional bonus features not implemented

- [ ] Comments, transcript highlights, and soundbites
- [ ] PDF export (Markdown and TXT export exist)
- [ ] Global transcript search across all meetings (library search does not query transcript segments)
- [ ] Tags and tag filtering beyond AI topics stored in JSON
- [ ] Full LLM meeting chat history/interface (single-question Ask FireMe exists)
- [ ] Dark mode

## What is not a gap

- Real speech-to-text is not mandatory in the brief. This project has an actual Groq transcription integration route and configured key; it still needs a representative media-file validation pass.
- A live meeting bot and third-party integrations are not mandatory in the brief.
- The project does use the requested Next.js, FastAPI, and SQLite stack.

## Recommended order of work

1. Run the complete Groq workflow end-to-end with a representative uploaded recording.
2. Fix action edit/delete UI, one-step transcript paste, date range, and video playback.
3. Add tests, refactor frontend, and patch dependencies.
4. Deploy frontend/API, migrate to Postgres + object storage if the deployment is public/multi-user.
5. Add auth and authorization before sharing the deployed app publicly.
6. Create public GitHub repo and submit repository + hosted URL.
