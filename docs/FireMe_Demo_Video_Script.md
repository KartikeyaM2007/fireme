# FireMe — Demo Video Script (Scaler)

**~7–8 minutes at a friendly pace | Kartikeya Krishna Mishra**

Use this as a cue card. Each beat has: time → what to click → what to say (with fallbacks) → a short code flash → why it matters for Scaler.

---

## Before you record

1. Open **https://fireme-chi.vercel.app** and wait until the cold-start note says **API is ready** (or check **https://fireme.onrender.com/api/health**).
2. Sign in if needed. Primary meeting: **Product roadmap sync**.
3. Optional real video: **WIN 20260723 Pro**.
4. Editor ready with the repo open for code flashes: https://github.com/KartikeyaM2007/fireme
5. Browser: full screen, zoom ~110%, hide bookmarks. Speak slowly. Pause on UI before cutting to code.

### Stack (say once early)

- Frontend: **Next.js**
- Backend: **FastAPI**
- DB: **SQLite** locally; live API uses **Postgres** with the same schema (`database.py`)

---

## Code flash map (open these ranges)

| Label | File:lines |
|-------|------------|
| Meeting models | `backend/models.py:L9–L41` |
| JWT require user | `backend/auth.py:L11–L47` |
| Seed roadmap sync | `backend/seed.py:L108–L140` |
| Meetings list API | `backend/main.py:L112–L146` |
| Generate insights | `backend/main.py:L406–L427` |
| POST ask endpoint | `backend/main.py:L446–L459` |
| Export entry | `backend/exports.py:L6–L20` |
| SQLite DATABASE_URL | `backend/database.py:L9–L14` |
| Seek / onTimeUpdate | `frontend/components/Workspace.tsx:L115–L156` |
| Transcript click-seek | `frontend/components/Workspace.tsx:L1777–L1798` |
| Toast stack | `frontend/components/Workspace.tsx:L2075–L2104` |
| Summary Generate | `frontend/components/Workspace.tsx:L1241–L1255` |
| Chapters + actions | `frontend/components/Workspace.tsx:L369–L404` |
| Pin / Share | `frontend/components/Workspace.tsx:L1145–L1173` |
| Settings DB note | `frontend/components/Workspace.tsx:L2007–L2016` |
| Live Coming soon | `frontend/components/LiveHub.tsx:L100–L150` |
| Speaker picker | `frontend/components/LiveHub.tsx:L437–L456` |
| Save live meeting | `frontend/components/LiveHub.tsx:L341–L386` |
| Hero workspace CTA | `frontend/components/Landing.tsx:L149–L167` |
| API ready note | `frontend/components/ColdStartNote.tsx:L47–L64` |

---

## Sections

### 0. Intro + stack — 0:00–0:40

**What you click / show**
1. Start on a blank tab or the FireMe logo.
2. Open the live app URL (do not rush into the workspace yet).
3. Optional: briefly show the GitHub repo root (`frontend/` and `backend/` folders).

**What you say**
> Hi — I'm Kartikeya. This is FireMe, a meeting intelligence workspace for Scaler.
> You can capture or open a meeting, get a structured summary, a synced transcript, ask questions with citations, clip moments, and export.
> Stack is Next.js on the front, FastAPI on the back. Locally it uses SQLite; the live API uses Postgres with the same schema.
> This walkthrough is about seven to eight minutes at a calm pace.

*If the page is slow to load, say:* “Hosted on free tiers — I’m warming the API first so the demo stays smooth.”

**Code flash** — `backend/models.py` lines **9–41** (5–8 sec)
Point at: `Meeting` and `TranscriptSegment` — the core data model for meetings and timed lines.

**Why it matters for Scaler**
Shows a real domain model, not a toy CRUD demo.

---

### 1. Landing CTA + auth — 0:40–1:20

**What you click / show**
1. On the landing hero, point at the headline briefly.
2. If signed out: click **Get Started** / sign in.
3. If signed in: click **Open your workspace** (or **Explore library**).
4. Land in the workspace sidebar.

**What you say**
> The landing page is the product pitch. The real work starts in the workspace.
> Auth is Clerk JWTs on the API — every meeting request requires a verified user.

*If sign-in fails, say:* “I’ll continue on the already-signed-in session — the gate is the same JWT check on the backend.”

**Code flash** — `frontend/components/Landing.tsx` lines **149–167**, then `backend/auth.py` lines **11–47**
Point at: hero CTAs that open the workspace; then `current_user` decoding the Bearer JWT.

**Why it matters for Scaler**
Auth-gated product surface, not an open playground.

---

### 2. Cold start wait — 1:20–1:50

**What you click / show**
1. Look for the cold-start banner (top or corner): “Waking the API” → “API is ready”.
2. Wait until ready before clicking meetings.
3. If already ready, point at it for one second and move on.

**What you say**
> The API is on Render’s free tier. After idle it can take thirty to sixty seconds to wake.
> FireMe shows that honestly with ColdStartNote, so reviewers don’t think the app is broken.

*If it stays on “still waking”, say:* “I’ll refresh once — free dynos sleep when unused. Health check is also at fireme.onrender.com/api/health.”

**Code flash** — `frontend/components/ColdStartNote.tsx` lines **47–64**
Point at: the ready / warming copy that sets expectations for evaluators.

**Why it matters for Scaler**
Production awareness — you handle cold starts instead of hiding them.

---

### 3. Library search + filters + open meeting — 1:50–2:40

**What you click / show**
1. In the meetings library, show the list.
2. Type a short search (e.g. `roadmap` or `analytics`) if the search box is visible; clear it.
3. Optionally glance at sort / filters if present.
4. Click **Product roadmap sync** (primary). Mention **WIN 20260723 Pro** as optional real video.

**What you say**
> New accounts get starter meetings from seed data so you can demo without uploading.
> Product roadmap sync is the main story — Q3 priorities, analytics as the anchor.
> The list API supports search and filters on the server, not only client-side.

*If the list is empty, say:* “Seed provision runs on first meetings fetch — I’ll refresh once.”

**Code flash** — `backend/seed.py` lines **108–140**, then `backend/main.py` lines **112–146**
Point at: `provision_starter_meetings` creating Product roadmap sync; then `GET /api/meetings` with query filters.

**Why it matters for Scaler**
Demo data + real list/search API = evaluable without setup friction.

---

### 4. Pin / Share (brief) — 2:40–3:00

**What you click / show**
1. Pin Product roadmap sync (pin icon) — watch toast “Pinned for quick demo”.
2. Click Share (or copy meeting link) — toast “Meeting link copied”.
3. Do not linger.

**What you say**
> Pin keeps the demo meeting at the top. Share copies a deep link with the meeting id.
> Small UX details, but they matter when you’re jumping around in a review.

*If clipboard is blocked, say:* “Browser blocked clipboard — the share helper is the same URL with a meeting query param.”

**Code flash** — `frontend/components/Workspace.tsx` lines **1145–1173**
Point at: `togglePin` and `shareMeeting` with toasts.

**Why it matters for Scaler**
Thoughtful workspace UX beyond a bare feature list.

---

### 5. Summary + Generate + actions + chapters — 3:00–3:50

**What you click / show**
1. Stay on **Summary** tab.
2. Skim AI summary, key topics, chapters.
3. Click **Generate** once if you want to show the path (or say it’s already seeded).
4. Toggle one action item checkbox on/off.
5. Click a **chapter** — player/transcript should jump (may switch to Transcript).

**What you say**
> Summary is the first value prop — skim decisions without rewatching the call.
> Generate calls the backend insights endpoint and fills summary, topics, chapters, and actions.
> I’ll toggle an action item… and click a chapter to jump into that moment.

*If Generate is slow or fails, say:* “Seeded summary is already here — Generate hits the same insights pipeline when the provider is warm.”

**Code flash** — `frontend/components/Workspace.tsx` lines **1241–1255** and **369–404**, then `backend/main.py` lines **406–427**
Point at: `generate()` posting to generate-insights; chapters `onSeek` + action checkbox; backend writing summary/actions.

**Why it matters for Scaler**
End-to-end AI insights wired UI ↔ API ↔ model fields.

---

### 6. Transcript search + click-to-seek (CORE) — 3:50–5:20

Spend the most time here. Slow down.

**What you click / show**
1. Open the **Transcript** tab.
2. Use transcript search/find if available — type `analytics` — show highlighted hit.
3. Click a **timestamp** on a line (e.g. Maya or Alex on analytics).
4. Watch the player seek and the active line highlight.
5. Scrub the seek bar a little — highlight should follow via `onTimeUpdate`.
6. Optional: click another line to prove it again.

**What you say**
> This is the core of FireMe.
> Every transcript line has a start time. Click the timestamp — the player jumps there.
> Scrub the player — the active line follows.
> That proves audio and text are one pipeline, not two disconnected screens.
> Search finds a moment; click-to-seek takes you there.

*If there is no media file, say:* “Even without a recording file, the seek bar and active line still sync on timestamps — that’s the same state.”

*If click does nothing, say:* “Seek state lives in Workspace — `setSeek` drives both the player and the playing class on segments.”

**Code flash** — `frontend/components/Workspace.tsx` lines **115–156**, then **1777–1798** (longest flash, ~8 sec each is fine)
Point at: `setSeek` / `onTimeUpdate` syncing media; segment button `onClick={() => setSeek(s.start_seconds)}`.

Optional brief flash — toast stack **2075–2104** if a toast appeared earlier (“Transcript ready — Generate”).

**Why it matters for Scaler**
Core product proof: time-aligned transcript UX, the assignment’s “wow” moment.

---

### 7. Ask FireMe — 5:20–6:00

**What you click / show**
1. Open **Ask FireMe** tab.
2. Type exactly: **What did we decide about analytics?**
3. Submit. Wait for the answer.
4. Point at the answer (and any citation / history if shown).

**What you say**
> Ask is grounded in this meeting’s transcript — not generic ChatGPT.
> Sample question: What did we decide about analytics?
> You should hear that analytics is the anchor for the release.
> Answers are stored on the meeting so history sticks around.

*If Ask is slow, say:* “First LLM call after wake can be slow — I’ll wait; the endpoint is POST ask on the meeting.”

*If it errors, say:* “When the provider is cold, the same UI path still posts to `/meetings/{id}/ask` — I’ll show that in code.”

**Code flash** — `backend/main.py` lines **446–459**
Point at: `ask` → `answer_question` → persist `MeetingQuestion`.

**Why it matters for Scaler**
Meeting-scoped RAG-style Q&A with persistence.

---

### 8. Clips / soundbite — 6:00–6:30

**What you click / show**
1. Open **Clips & notes**.
2. If a soundbite/highlight exists (seeded on Product roadmap sync), click play on it.
3. If empty: go to Transcript → use highlight/soundbite action on a line → save → return to Clips.

**What you say**
> Clips and soundbites turn a moment into something you can replay or share.
> Seeded demo extras include a soundbite so you don’t have to create one live.

*If none exist, say:* “I’ll skip creating one live — the note kinds are comment, highlight, and soundbite on segment notes.”

**Code flash** — `frontend/components/Workspace.tsx` lines **1884–1918** (clips play / soundbite seek)
Point at: soundbite sets `clipPlay` start/end so the player plays a range.

**Why it matters for Scaler**
Moments become reusable artifacts, not just a wall of text.

---

### 9. Export — 6:30–6:55

**What you click / show**
1. Open Export (toolbar / menu → Export meeting).
2. Show Markdown / TXT / PDF choices.
3. Click one (e.g. Markdown) and show the download starting.

**What you say**
> Export packages summary, actions, and transcript for handoff.
> Same content path powers markdown, text, and PDF.

*If download is blocked, say:* “The API route is GET export with a format query — browser blocked the file, but the endpoint is the same.”

**Code flash** — `backend/exports.py` lines **6–20**, mention `main.py` export route ~474–498
Point at: `export_text` building summary + actions + timed transcript.

**Why it matters for Scaler**
Deliverable output — meetings leave the app as documents.

---

### 10. Live Hub — Coming soon + capture + speakers + save — 6:55–7:40

**What you click / show**
1. Open the **Live** tab / hub.
2. Point at Zoom / Meet / Teams cards — **Coming soon**.
3. Click **Start live capture**.
4. Show Speaker **1 / 2 / 3** picker — switch speakers once.
5. Optionally speak one short line (or type if UI allows).
6. Click **Save as meeting** (or stop + save). If you don’t want a new meeting, explain the path and go Back.

**What you say**
> Live Hub is for in-progress conversations.
> Platform bots are Coming soon — honest roadmap.
> Browser capture works today with the Web Speech API.
> You label the next lines as Speaker 1, 2, or 3, then save into the same meetings workspace.

*If mic permission is denied, say:* “I won’t force the mic in this recording — the save path posts a meeting plus timestamped segments.”

**Code flash** — `LiveHub.tsx` lines **100–150** (Coming soon + start), **437–456** (speakers), **341–386** (save)
Point at: Coming soon pills; speaker buttons; `save` creating meeting + segments.

**Why it matters for Scaler**
Capture → same post-meeting workspace; clear shipped vs soon.

---

### 11. Settings DB note + logo home — 7:40–7:55

**What you click / show**
1. Open **Settings**.
2. Read the DB line: SQLite locally; live API Postgres; Render cold start note.
3. Close Settings.
4. Click the **FireMe logo / brand home** to return to landing.

**What you say**
> Settings calls out the database story and Coming soon integrations.
> Logo takes you home — clean exit back to the marketing surface.

**Code flash** — `frontend/components/Workspace.tsx` lines **2007–2016**, then `backend/database.py` lines **9–14**
Point at: Settings copy; `DATABASE_URL` defaulting to `sqlite:///./fireme.db`.

**Why it matters for Scaler**
Local/prod parity explained; no mystery infrastructure.

---

### 12. Closing — GitHub folders — 7:55–8:15

**What you click / show**
1. Open GitHub: https://github.com/KartikeyaM2007/fireme
2. Point at **`frontend/`** and **`backend/`**.
3. End on that frame or back on the landing hero.

**What you say**
> That’s FireMe — landing and auth, cold-start honesty, seeded library, summary and actions, synced transcript, Ask, clips, export, and live capture.
> Code is split cleanly into frontend and backend on GitHub.
> Thanks for watching — happy to answer questions.

---

## Cheat sheet

| Time | On screen | Code flash | Say (short) |
|------|-----------|------------|-------------|
| 0:00 | Logo / open app | `models.py:L9–L41` | Intro + Next/FastAPI/SQLite→Postgres |
| 0:40 | Landing CTA → workspace | `Landing.tsx:L149–L167` + `auth.py:L11–L47` | Hero CTA; JWT gate |
| 1:20 | Cold start banner | `ColdStartNote.tsx:L47–L64` | Wait for API ready |
| 1:50 | Library search → open meeting | `seed.py:L108–L140` + `main.py:L112–L146` | Product roadmap sync |
| 2:40 | Pin + Share | `Workspace.tsx:L1145–L1173` | Pin toast; copy link |
| 3:00 | Summary / Generate / action / chapter | `Workspace.tsx:L1241–L1255`, `L369–L404` + `main.py:L406–L427` | Insights + toggle + jump |
| 3:50 | Transcript search + click-seek | `Workspace.tsx:L115–L156`, `L1777–L1798` | **CORE** sync proof |
| 5:20 | Ask sample question | `main.py:L446–L459` | Analytics decision |
| 6:00 | Clips / soundbite | `Workspace.tsx:L1884–L1918` | Replay a moment |
| 6:30 | Export download | `exports.py:L6–L20` | MD / TXT / PDF |
| 6:55 | Live hub + speakers + save | `LiveHub.tsx:L100–L150`, `L437–L456`, `L341–L386` | Coming soon + capture |
| 7:40 | Settings + logo home | `Workspace.tsx:L2007–L2016` + `database.py:L9–L14` | DB note; home |
| 7:55 | GitHub frontend/ backend/ | repo root | Close + thanks |

---

## Recording tips

- Wake the app **before** you hit record. Friendly pace = ~7–8 minutes total.
- Primary meeting: **Product roadmap sync**. Optional video: **WIN 20260723 Pro**.
- Longest beat = transcript ↔ player sync. Do it twice if needed.
- Ask sample question exactly: **What did we decide about analytics?**
- Code flashes: open file, jump to line range, highlight ~15–40 lines, speak one sentence, cut back to UI within 5–8 seconds (CORE may be longer).
- If anything fails, use the fallback line — never freeze silently.
- Keep UI readable: full-screen browser, zoom ~110%, hide bookmarks bar.
