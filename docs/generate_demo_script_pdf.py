"""Generate FireMe Scaler demo video script PDF from the expanded structure."""
from pathlib import Path

from fpdf import FPDF

OUT_DIR = Path(__file__).resolve().parent
PDF_PATH = OUT_DIR / "FireMe_Demo_Video_Script.pdf"
MD_PATH = OUT_DIR / "FireMe_Demo_Video_Script.md"


class ScriptPDF(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "FireMe - Demo Video Script (Scaler)  |  ~7-8 min", align="L")
        self.ln(10)
        self.set_draw_color(200, 200, 200)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 8, f"Page {self.page_no()}/{{nb}}", align="C")


def h1(pdf: ScriptPDF, text: str):
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(20, 20, 20)
    pdf.multi_cell(0, 9, text)
    pdf.ln(2)


def h2(pdf: ScriptPDF, text: str):
    pdf.ln(3)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(30, 30, 30)
    pdf.multi_cell(0, 7, text)
    pdf.ln(1)


def _reset_x(pdf: ScriptPDF):
    pdf.set_x(pdf.l_margin)


def h3(pdf: ScriptPDF, text: str):
    if pdf.get_y() > pdf.h - 55:
        pdf.add_page()
    pdf.ln(2)
    _reset_x(pdf)
    pdf.set_fill_color(245, 245, 245)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(25, 25, 25)
    pdf.multi_cell(0, 7, text, fill=True)
    _reset_x(pdf)
    pdf.ln(1)


def body(pdf: ScriptPDF, text: str):
    _reset_x(pdf)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(35, 35, 35)
    pdf.multi_cell(0, 5.2, text)
    _reset_x(pdf)
    pdf.ln(0.8)


def bullet(pdf: ScriptPDF, text: str, indent: float = 3):
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(35, 35, 35)
    x = pdf.l_margin + indent
    pdf.set_x(x)
    pdf.multi_cell(pdf.w - pdf.r_margin - x, 5.2, f"- {text}")
    _reset_x(pdf)


def labeled(pdf: ScriptPDF, label: str, text: str):
    _reset_x(pdf)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(35, 35, 35)
    pdf.multi_cell(0, 5.2, label)
    _reset_x(pdf)
    pdf.set_font("Helvetica", "", 10)
    pdf.multi_cell(0, 5.2, text)
    _reset_x(pdf)
    pdf.ln(0.6)


def code_flash(pdf: ScriptPDF, file_lines: str, point: str):
    _reset_x(pdf)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(20, 70, 120)
    pdf.multi_cell(0, 5.2, f"Code flash: {file_lines}")
    _reset_x(pdf)
    pdf.set_font("Helvetica", "", 9.5)
    pdf.set_text_color(50, 50, 50)
    pdf.multi_cell(0, 5, f"Point at: {point}  (5-8 sec)")
    _reset_x(pdf)
    pdf.ln(0.6)


def say_block(pdf: ScriptPDF, text: str, fallback: str = ""):
    _reset_x(pdf)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(35, 35, 35)
    pdf.multi_cell(0, 5.2, "What you say")
    _reset_x(pdf)
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(0, 5.2, text)
    if fallback:
        _reset_x(pdf)
        pdf.set_font("Helvetica", "", 9.5)
        pdf.set_text_color(90, 60, 20)
        pdf.multi_cell(0, 5, f"If it fails: {fallback}")
    _reset_x(pdf)
    pdf.ln(0.6)


LINE_MAP = [
    ("Meeting models", "backend/models.py lines 9-41"),
    ("JWT require user", "backend/auth.py lines 11-47"),
    ("Seed roadmap sync", "backend/seed.py lines 108-140"),
    ("Meetings list API", "backend/main.py lines 112-146"),
    ("Generate insights", "backend/main.py lines 406-427"),
    ("POST ask endpoint", "backend/main.py lines 446-459"),
    ("Export entry", "backend/exports.py lines 6-20"),
    ("SQLite DATABASE_URL", "backend/database.py lines 9-14"),
    ("Seek / onTimeUpdate", "Workspace.tsx lines 115-156"),
    ("Transcript click-seek", "Workspace.tsx lines 1777-1798"),
    ("Toast stack", "Workspace.tsx lines 2075-2104"),
    ("Summary Generate", "Workspace.tsx lines 1241-1255"),
    ("Chapters + actions", "Workspace.tsx lines 369-404"),
    ("Pin / Share", "Workspace.tsx lines 1145-1173"),
    ("Settings DB note", "Workspace.tsx lines 2007-2016"),
    ("Live Coming soon", "LiveHub.tsx lines 100-150"),
    ("Speaker picker", "LiveHub.tsx lines 437-456"),
    ("Save live meeting", "LiveHub.tsx lines 341-386"),
    ("Hero workspace CTA", "Landing.tsx lines 149-167"),
    ("API ready note", "ColdStartNote.tsx lines 47-64"),
]

SECTIONS = [
    {
        "title": "0. Intro + stack  |  0:00-0:40",
        "show": (
            "1) Blank tab or FireMe logo. 2) Open live app URL. "
            "3) Optional: show GitHub repo root with frontend/ and backend/ folders."
        ),
        "say": (
            "Hi - I'm Kartikeya. This is FireMe, a meeting intelligence workspace for Scaler. "
            "Capture or open a meeting, get a structured summary, a synced transcript, ask with citations, "
            "clip moments, and export. Stack: Next.js front, FastAPI back. SQLite locally; live API uses "
            "Postgres with the same schema. About seven to eight minutes at a calm pace."
        ),
        "fail": "Hosted on free tiers - I'm warming the API first so the demo stays smooth.",
        "code": "backend/models.py lines 9-41",
        "point": "Meeting and TranscriptSegment - core timed meeting model.",
        "why": "Shows a real domain model, not toy CRUD.",
    },
    {
        "title": "1. Landing CTA + auth  |  0:40-1:20",
        "show": (
            "1) Point at landing hero. 2) Signed out: Get Started / sign in. "
            "3) Signed in: Open your workspace. 4) Land in workspace sidebar."
        ),
        "say": (
            "Landing is the product pitch. Real work starts in the workspace. "
            "Auth is Clerk JWTs on the API - every meeting request needs a verified user."
        ),
        "fail": "Continue on signed-in session - same JWT check on the backend.",
        "code": "Landing.tsx lines 149-167; then auth.py lines 11-47",
        "point": "Hero CTAs open workspace; current_user decodes Bearer JWT.",
        "why": "Auth-gated product surface, not an open playground.",
    },
    {
        "title": "2. Cold start wait  |  1:20-1:50",
        "show": (
            "Watch cold-start banner: Waking the API -> API is ready. "
            "Wait before clicking meetings. If already ready, point once and move on."
        ),
        "say": (
            "API is on Render free tier. After idle it can take 30-60 seconds. "
            "ColdStartNote shows that honestly so reviewers don't think the app is broken."
        ),
        "fail": "Refresh once; health check at fireme.onrender.com/api/health.",
        "code": "ColdStartNote.tsx lines 47-64",
        "point": "Ready / warming copy that sets evaluator expectations.",
        "why": "Production awareness - handle cold starts openly.",
    },
    {
        "title": "3. Library search + filters + open meeting  |  1:50-2:40",
        "show": (
            "1) Meetings list. 2) Search roadmap or analytics; clear. "
            "3) Optional sort/filters. 4) Open Product roadmap sync. Mention WIN 20260723 Pro optional."
        ),
        "say": (
            "Starter meetings come from seed data - no upload required. "
            "Product roadmap sync is the main story. List API supports search and filters on the server."
        ),
        "fail": "Seed runs on first meetings fetch - refresh once.",
        "code": "seed.py lines 108-140; main.py lines 112-146",
        "point": "provision_starter_meetings; GET /api/meetings with query filters.",
        "why": "Demo data + real list/search API without setup friction.",
    },
    {
        "title": "4. Pin / Share (brief)  |  2:40-3:00",
        "show": "Pin Product roadmap sync (toast). Share / copy meeting link (toast). Do not linger.",
        "say": (
            "Pin keeps the demo meeting on top. Share copies a deep link with the meeting id. "
            "Small UX details that help in a review."
        ),
        "fail": "Clipboard blocked - same URL with meeting query param.",
        "code": "Workspace.tsx lines 1145-1173",
        "point": "togglePin and shareMeeting with toasts.",
        "why": "Thoughtful workspace UX beyond a bare feature list.",
    },
    {
        "title": "5. Summary + Generate + actions + chapters  |  3:00-3:50",
        "show": (
            "Summary tab: skim summary/topics/chapters. Click Generate if useful. "
            "Toggle one action checkbox. Click a chapter to jump."
        ),
        "say": (
            "Summary is the first value prop - skim without rewatching. "
            "Generate fills summary, topics, chapters, and actions. "
            "Toggle an action, then click a chapter to jump into that moment."
        ),
        "fail": "Seeded summary is already here - same insights pipeline when warm.",
        "code": "Workspace.tsx lines 1241-1255 and 369-404; main.py lines 406-427",
        "point": "generate() POST; chapters onSeek + action checkbox; backend writes fields.",
        "why": "End-to-end AI insights wired UI to API to model fields.",
    },
    {
        "title": "6. Transcript search + click-to-seek (CORE)  |  3:50-5:20",
        "show": (
            "1) Transcript tab. 2) Search analytics. 3) Click a timestamp. "
            "4) Player seeks; active line highlights. 5) Scrub seek bar - highlight follows. "
            "6) Optional second click. LONGEST BEAT - slow down."
        ),
        "say": (
            "This is the core of FireMe. Every line has a start time. Click the timestamp - player jumps. "
            "Scrub the player - active line follows. Audio and text are one pipeline. "
            "Search finds a moment; click-to-seek takes you there."
        ),
        "fail": (
            "No media: seek bar and active line still sync on timestamps. "
            "Click noop: setSeek drives player and playing class."
        ),
        "code": "Workspace.tsx lines 115-156; then lines 1777-1798 (optional toast 2075-2104)",
        "point": "setSeek / onTimeUpdate; segment onClick setSeek(start_seconds).",
        "why": "Core product proof - time-aligned transcript UX.",
    },
    {
        "title": "7. Ask FireMe  |  5:20-6:00",
        "show": (
            "Ask FireMe tab. Type exactly: What did we decide about analytics? "
            "Submit. Show answer and history/citations if present."
        ),
        "say": (
            "Ask is grounded in this meeting's transcript - not generic chat. "
            "Sample: What did we decide about analytics? Analytics anchors the release. "
            "Answers are stored on the meeting."
        ),
        "fail": "First LLM call after wake can be slow - endpoint is POST ask.",
        "code": "backend/main.py lines 446-459",
        "point": "ask -> answer_question -> persist MeetingQuestion.",
        "why": "Meeting-scoped Q&A with persistence.",
    },
    {
        "title": "8. Clips / soundbite  |  6:00-6:30",
        "show": (
            "Clips & notes tab. Play seeded soundbite/highlight if present. "
            "Or create from Transcript line actions."
        ),
        "say": (
            "Clips and soundbites turn a moment into something you can replay. "
            "Seeded demo extras include a soundbite so you need not create one live."
        ),
        "fail": "Skip creating live - note kinds are comment, highlight, soundbite.",
        "code": "Workspace.tsx lines 1884-1918",
        "point": "Soundbite sets clipPlay start/end for ranged playback.",
        "why": "Moments become reusable artifacts.",
    },
    {
        "title": "9. Export  |  6:30-6:55",
        "show": "Open Export meeting. Show Markdown / TXT / PDF. Download one format.",
        "say": (
            "Export packages summary, actions, and transcript for handoff. "
            "Same content path powers markdown, text, and PDF."
        ),
        "fail": "Browser blocked download - API is GET export with format query.",
        "code": "backend/exports.py lines 6-20 (route main.py ~474-498)",
        "point": "export_text builds summary + actions + timed transcript.",
        "why": "Deliverable output - meetings leave as documents.",
    },
    {
        "title": "10. Live Hub  |  6:55-7:40",
        "show": (
            "Live hub: point Coming soon on Zoom/Meet/Teams. Start live capture. "
            "Switch Speaker 1/2/3. Optional short line. Save as meeting or explain and Back."
        ),
        "say": (
            "Live Hub is for in-progress conversations. Platform bots are Coming soon. "
            "Browser capture works today. Label Speaker 1/2/3, then save into the same workspace."
        ),
        "fail": "Mic denied - save path posts meeting plus timestamped segments.",
        "code": "LiveHub.tsx lines 100-150; 437-456; 341-386",
        "point": "Coming soon pills; speaker buttons; save creates meeting + segments.",
        "why": "Capture into same post-meeting workspace; clear shipped vs soon.",
    },
    {
        "title": "11. Settings DB note + logo home  |  7:40-7:55",
        "show": (
            "Open Settings - read SQLite locally / Postgres live / Render note. "
            "Close. Click FireMe logo / brand home to landing."
        ),
        "say": (
            "Settings calls out the database story and Coming soon integrations. "
            "Logo takes you home - clean exit to the marketing surface."
        ),
        "fail": "",
        "code": "Workspace.tsx lines 2007-2016; database.py lines 9-14",
        "point": "Settings DB copy; DATABASE_URL default sqlite:///./fireme.db.",
        "why": "Local/prod parity explained.",
    },
    {
        "title": "12. Closing - GitHub folders  |  7:55-8:15",
        "show": (
            "Open github.com/KartikeyaM2007/fireme. Point at frontend/ and backend/. "
            "End on that frame or landing hero."
        ),
        "say": (
            "That's FireMe - landing and auth, cold-start honesty, seeded library, summary and actions, "
            "synced transcript, Ask, clips, export, and live capture. "
            "Code splits cleanly into frontend and backend. Thanks for watching."
        ),
        "fail": "",
        "code": "GitHub repo root - frontend/ and backend/",
        "point": "Folder split for reviewers.",
        "why": "Clear project structure for evaluation.",
    },
]

CHEAT = [
    ("0:00", "Logo / open app", "models.py 9-41", "Intro + stack"),
    ("0:40", "Landing -> workspace", "Landing 149-167; auth 11-47", "CTA + JWT"),
    ("1:20", "Cold start banner", "ColdStartNote 47-64", "API ready"),
    ("1:50", "Library + open meeting", "seed 108-140; main 112-146", "Roadmap sync"),
    ("2:40", "Pin + Share", "Workspace 1145-1173", "Pin toast; link"),
    ("3:00", "Summary / actions", "Workspace 1241-1255, 369-404", "Generate + jump"),
    ("3:50", "Transcript seek CORE", "Workspace 115-156, 1777-1798", "Click timestamp"),
    ("5:20", "Ask FireMe", "main.py 446-459", "Analytics Q"),
    ("6:00", "Clips / soundbite", "Workspace 1884-1918", "Replay moment"),
    ("6:30", "Export", "exports.py 6-20", "MD/TXT/PDF"),
    ("6:55", "Live Hub", "LiveHub 100-150, 437-456, 341-386", "Speakers + save"),
    ("7:40", "Settings + home", "Workspace 2007-2016; database 9-14", "DB note"),
    ("7:55", "GitHub folders", "frontend/ + backend/", "Close + thanks"),
]

TIPS = [
    "Wake the app before you hit record. Friendly pace = ~7-8 minutes total.",
    "Primary meeting: Product roadmap sync. Optional video: WIN 20260723 Pro.",
    "Longest beat = transcript <-> player sync. Do it twice if needed.",
    "Ask sample question exactly: What did we decide about analytics?",
    "Code flashes: jump to line range, highlight ~15-40 lines, one sentence, back to UI in 5-8 sec.",
    "If anything fails, use the fallback line - never freeze silently.",
    "Full-screen browser, zoom ~110%, hide bookmarks bar.",
]


def build_pdf():
    pdf = ScriptPDF(orientation="P", unit="mm", format="A4")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.set_margins(15, 14, 15)
    pdf.add_page()

    h1(pdf, "FireMe - Demo Video Script (Scaler)")
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(0, 6, "~7-8 minutes at a friendly pace  |  Kartikeya Krishna Mishra")
    pdf.ln(1)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(60, 60, 60)
    pdf.multi_cell(
        0,
        5.2,
        "Cue card for a nervous presenter. Each beat: time, mouse path, spoken lines "
        "(with fallbacks), code flash with exact line ranges, and why it matters for Scaler.",
    )
    pdf.ln(2)
    pdf.set_draw_color(180, 180, 180)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(3)

    h2(pdf, "Before you record")
    for t in [
        "Wake https://fireme-chi.vercel.app until ColdStartNote says API is ready.",
        "Or check https://fireme.onrender.com/api/health.",
        "Primary meeting: Product roadmap sync. Optional: WIN 20260723 Pro.",
        "Stack: Next.js + FastAPI; SQLite locally, Postgres on live API.",
        "GitHub: https://github.com/KartikeyaM2007/fireme",
        "Keep editor open for code flashes. Speak slowly.",
    ]:
        bullet(pdf, t)

    h2(pdf, "Code flash map (exact line ranges)")
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(52, 6.5, "Label", border=1, fill=True)
    pdf.cell(128, 6.5, "File lines", border=1, fill=True)
    pdf.ln()
    pdf.set_font("Helvetica", "", 8.5)
    for label, lines in LINE_MAP:
        if pdf.get_y() > pdf.h - 20:
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_fill_color(240, 240, 240)
            pdf.cell(52, 6.5, "Label", border=1, fill=True)
            pdf.cell(128, 6.5, "File lines", border=1, fill=True)
            pdf.ln()
            pdf.set_font("Helvetica", "", 8.5)
        pdf.cell(52, 5.8, label, border=1)
        pdf.cell(128, 5.8, lines, border=1)
        pdf.ln()

    h2(pdf, "Sections")
    for s in SECTIONS:
        h3(pdf, s["title"])
        labeled(pdf, "What you click / show", s["show"])
        say_block(pdf, s["say"], s.get("fail") or "")
        code_flash(pdf, s["code"], s["point"])
        _reset_x(pdf)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(35, 35, 35)
        pdf.multi_cell(0, 5.2, "Why it matters for Scaler")
        _reset_x(pdf)
        pdf.set_font("Helvetica", "", 10)
        pdf.multi_cell(0, 5.2, s["why"])
        _reset_x(pdf)
        pdf.ln(1)

    h2(pdf, "Cheat sheet")
    col_w = [16, 42, 72, 50]
    headers = ["Time", "On screen", "Code flash (lines)", "Say"]
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_fill_color(240, 240, 240)
    for i, h in enumerate(headers):
        pdf.cell(col_w[i], 6.5, h, border=1, fill=True)
    pdf.ln()

    for row in CHEAT:
        line_h = 4.2
        lines_needed = 1
        pdf.set_font("Helvetica", "", 7.5)
        for i, cell in enumerate(row):
            n = max(1, int(pdf.get_string_width(cell) / max(col_w[i] - 2, 8)) + 1)
            lines_needed = max(lines_needed, min(n, 3))
        row_h = line_h * lines_needed + 1.5
        if pdf.get_y() + row_h > pdf.h - 18:
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_fill_color(240, 240, 240)
            for i, h in enumerate(headers):
                pdf.cell(col_w[i], 6.5, h, border=1, fill=True)
            pdf.ln()
            pdf.set_font("Helvetica", "", 7.5)

        x = pdf.l_margin
        y = pdf.get_y()
        for i, cell in enumerate(row):
            pdf.set_xy(x, y)
            pdf.multi_cell(col_w[i], line_h, cell, border=0)
            pdf.rect(x, y, col_w[i], row_h)
            x += col_w[i]
        pdf.set_xy(pdf.l_margin, y + row_h)

    pdf.ln(3)
    h2(pdf, "Recording tips")
    for tip in TIPS:
        bullet(pdf, tip)

    pdf.output(str(PDF_PATH))
    print(f"Wrote {PDF_PATH}")


if __name__ == "__main__":
    # Markdown is authored separately (richer formatting); regenerate PDF only here
    # unless MD is missing — then warn.
    if not MD_PATH.exists():
        print(f"Warning: {MD_PATH} missing; PDF only.")
    build_pdf()
