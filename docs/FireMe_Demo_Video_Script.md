# FireMe - Demo Video Script (Scaler)

**~5-6 minutes | Kartikeya Krishna Mishra**

## Before you record

- Wake **https://fireme-chi.vercel.app** until the API is ready; or check **https://fireme.onrender.com/api/health**.
- Primary meeting: **Product roadmap sync**.
- Optional: **WIN 20260723 Pro** for real video.
- GitHub: https://github.com/KartikeyaM2007/fireme

## Sections

### 0. Intro

- **Code:** `backend/app/models.py`
- **Show:** Logo / blank tab, then open the live app URL.
- **Say:** Hi - I'm Kartikeya. FireMe is a meeting intelligence workspace: record or upload a meeting, get a structured summary, a synced transcript, ask questions with citations, and export clips. Built for Scaler - about five minutes end to end.

### 1. Landing + workspace

- **Code:** `frontend Landing.tsx, backend auth.py, ColdStartNote.tsx`
- **Show:** Landing page hero and CTA. Sign in / enter workspace. If cold start banner appears, wait for API health then continue.
- **Say:** Landing is the product pitch. Auth gates the workspace. Hosted API may cold-start - ColdStartNote surfaces that so demo time isn't wasted.

### 2. Meetings library

- **Code:** `backend seed.py (demo meetings)`
- **Show:** Meetings list - open Primary meeting: Product roadmap sync. Optionally note WIN 20260723 Pro.
- **Say:** Seeded demo meetings so reviewers don't need a fresh upload. I'll use Product roadmap sync as the primary walkthrough.

### 3. Summary tab

- **Code:** `frontend Workspace.tsx (Summary)`
- **Show:** Open the meeting -> Summary tab: decisions, action items, overview.
- **Say:** Summary is the first value prop - structured notes you can skim without rewatching.

### 4. Transcript + player sync (CORE)

- **Code:** `frontend Workspace.tsx - seek / timestamp click`
- **Show:** Transcript tab. Click a timestamp; player jumps. Scrub player; highlight follows.
- **Say:** This is the core demo beat: transcript and player stay in sync. Click any line to seek - proof the pipeline ties audio to text.

### 5. Ask FireMe

- **Code:** `backend main.py - POST /ask (or ask endpoint)`
- **Show:** Ask FireMe panel. Type: What did we decide about analytics? Submit; show answer + citations.
- **Say:** Ask FireMe answers from this meeting's context - not generic chat. Sample: What did we decide about analytics? Watch citations point back into the transcript.

### 6. Clips & export

- **Code:** `backend exports.py`
- **Show:** Select a range or clip -> export (download / share path as implemented).
- **Say:** Exports turn moments into shareable artifacts - clips and packages via the export pipeline.

### 7. Live capture

- **Code:** `frontend LiveHub.tsx`
- **Show:** Live Hub: start/manual capture UI. Label Speaker 1 / 2 / 3 manually. Point at Coming soon for meeting bots.
- **Say:** Live capture is for in-progress meetings. Speakers can be tagged manually today; bot joins are marked Coming soon.

### 8. Logo home + close

- **Code:** `-`
- **Show:** Click logo / home -> landing. End on GitHub link if useful.
- **Say:** That's FireMe - summary, synced transcript, Ask, clips, and live. Code: github.com/KartikeyaM2007/fireme. Thanks.

## Cheat sheet

| Time | UI | Code | Say |
|------|----|------|-----|
| 0:00 | Logo / open app | `models.py` | Intro + what FireMe is |
| 0:30 | Landing -> workspace | `Landing, auth, ColdStart` | Auth + cold-start note |
| 1:10 | Meetings library | `seed.py` | Open Product roadmap sync |
| 1:40 | Summary tab | `Workspace.tsx` | Decisions & action items |
| 2:20 | Transcript + seek | `Workspace seek` | CORE: click timestamp |
| 3:20 | Ask FireMe | `POST ask` | Analytics decision Q |
| 4:10 | Clips & export | `exports.py` | Export a moment |
| 4:50 | Live Hub | `LiveHub.tsx` | Speakers; bots soon |
| 5:30 | Logo / close | `-` | GitHub + thanks |

## Recording tips

- Wake https://fireme-chi.vercel.app (or health-check Render) before record - wait until API ready.
- Primary meeting: Product roadmap sync. Optional real video: WIN 20260723 Pro.
- Spend the most time on transcript <-> player sync; that is the CORE beat.
- Ask sample question exactly: What did we decide about analytics?
- Keep UI readable: full-screen browser, zoom ~110%, hide bookmarks bar.
