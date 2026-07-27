"""Generate FireMe Scaler demo video script PDF (+ optional MD twin)."""
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
        self.cell(0, 8, "FireMe - Demo Video Script (Scaler)", align="L")
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
    pdf.ln(2)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(30, 30, 30)
    pdf.multi_cell(0, 7, text)
    pdf.ln(1)


def h3(pdf: ScriptPDF, text: str):
    pdf.ln(1)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(40, 40, 40)
    pdf.multi_cell(0, 6, text)
    pdf.ln(0.5)


def body(pdf: ScriptPDF, text: str):
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(35, 35, 35)
    pdf.multi_cell(0, 5.5, text)
    pdf.ln(1)


def bullet(pdf: ScriptPDF, text: str, indent: float = 4):
    pdf.set_font("Helvetica", "", 10.5)
    pdf.set_text_color(35, 35, 35)
    x = pdf.l_margin + indent
    pdf.set_x(x)
    pdf.multi_cell(pdf.w - pdf.r_margin - x, 5.5, f"- {text}")


def label_line(pdf: ScriptPDF, label: str, text: str):
    pdf.set_font("Helvetica", "B", 10.5)
    pdf.set_text_color(35, 35, 35)
    pdf.write(5.5, f"{label}: ")
    pdf.set_font("Helvetica", "", 10.5)
    pdf.write(5.5, text)
    pdf.ln(6)


SECTIONS = [
    {
        "title": "0. Intro",
        "code": "backend/app/models.py",
        "show": "Logo / blank tab, then open the live app URL.",
        "say": (
            "Hi - I'm Kartikeya. FireMe is a meeting intelligence workspace: "
            "record or upload a meeting, get a structured summary, a synced transcript, "
            "ask questions with citations, and export clips. Built for Scaler - "
            "about five minutes end to end."
        ),
    },
    {
        "title": "1. Landing + workspace",
        "code": "frontend Landing.tsx, backend auth.py, ColdStartNote.tsx",
        "show": (
            "Landing page hero and CTA. Sign in / enter workspace. "
            "If cold start banner appears, wait for API health then continue."
        ),
        "say": (
            "Landing is the product pitch. Auth gates the workspace. "
            "Hosted API may cold-start - ColdStartNote surfaces that so demo time isn't wasted."
        ),
    },
    {
        "title": "2. Meetings library",
        "code": "backend seed.py (demo meetings)",
        "show": "Meetings list - open Primary meeting: Product roadmap sync. Optionally note WIN 20260723 Pro.",
        "say": (
            "Seeded demo meetings so reviewers don't need a fresh upload. "
            "I'll use Product roadmap sync as the primary walkthrough."
        ),
    },
    {
        "title": "3. Summary tab",
        "code": "frontend Workspace.tsx (Summary)",
        "show": "Open the meeting -> Summary tab: decisions, action items, overview.",
        "say": (
            "Summary is the first value prop - structured notes you can skim without rewatching."
        ),
    },
    {
        "title": "4. Transcript + player sync (CORE)",
        "code": "frontend Workspace.tsx - seek / timestamp click",
        "show": "Transcript tab. Click a timestamp; player jumps. Scrub player; highlight follows.",
        "say": (
            "This is the core demo beat: transcript and player stay in sync. "
            "Click any line to seek - proof the pipeline ties audio to text."
        ),
    },
    {
        "title": "5. Ask FireMe",
        "code": "backend main.py - POST /ask (or ask endpoint)",
        "show": "Ask FireMe panel. Type: What did we decide about analytics? Submit; show answer + citations.",
        "say": (
            "Ask FireMe answers from this meeting's context - not generic chat. "
            "Sample: What did we decide about analytics? Watch citations point back into the transcript."
        ),
    },
    {
        "title": "6. Clips & export",
        "code": "backend exports.py",
        "show": "Select a range or clip -> export (download / share path as implemented).",
        "say": (
            "Exports turn moments into shareable artifacts - clips and packages via the export pipeline."
        ),
    },
    {
        "title": "7. Live capture",
        "code": "frontend LiveHub.tsx",
        "show": (
            "Live Hub: start/manual capture UI. Label Speaker 1 / 2 / 3 manually. "
            "Point at Coming soon for meeting bots."
        ),
        "say": (
            "Live capture is for in-progress meetings. Speakers can be tagged manually today; "
            "bot joins are marked Coming soon."
        ),
    },
    {
        "title": "8. Logo home + close",
        "code": "-",
        "show": "Click logo / home -> landing. End on GitHub link if useful.",
        "say": (
            "That's FireMe - summary, synced transcript, Ask, clips, and live. "
            "Code: github.com/KartikeyaM2007/fireme. Thanks."
        ),
    },
]

CHEAT = [
    ("0:00", "Logo / open app", "models.py", "Intro + what FireMe is"),
    ("0:30", "Landing -> workspace", "Landing, auth, ColdStart", "Auth + cold-start note"),
    ("1:10", "Meetings library", "seed.py", "Open Product roadmap sync"),
    ("1:40", "Summary tab", "Workspace.tsx", "Decisions & action items"),
    ("2:20", "Transcript + seek", "Workspace seek", "CORE: click timestamp"),
    ("3:20", "Ask FireMe", "POST ask", "Analytics decision Q"),
    ("4:10", "Clips & export", "exports.py", "Export a moment"),
    ("4:50", "Live Hub", "LiveHub.tsx", "Speakers; bots soon"),
    ("5:30", "Logo / close", "-", "GitHub + thanks"),
]

TIPS = [
    "Wake https://fireme-chi.vercel.app (or health-check Render) before record - wait until API ready.",
    "Primary meeting: Product roadmap sync. Optional real video: WIN 20260723 Pro.",
    "Spend the most time on transcript <-> player sync; that is the CORE beat.",
    "Ask sample question exactly: What did we decide about analytics?",
    "Keep UI readable: full-screen browser, zoom ~110%, hide bookmarks bar.",
]


def build_md() -> str:
    lines = [
        "# FireMe - Demo Video Script (Scaler)",
        "",
        "**~5-6 minutes | Kartikeya Krishna Mishra**",
        "",
        "## Before you record",
        "",
        "- Wake **https://fireme-chi.vercel.app** until the API is ready; or check **https://fireme.onrender.com/api/health**.",
        "- Primary meeting: **Product roadmap sync**.",
        "- Optional: **WIN 20260723 Pro** for real video.",
        "- GitHub: https://github.com/KartikeyaM2007/fireme",
        "",
        "## Sections",
        "",
    ]
    for s in SECTIONS:
        lines += [
            f"### {s['title']}",
            "",
            f"- **Code:** `{s['code']}`",
            f"- **Show:** {s['show']}",
            f"- **Say:** {s['say']}",
            "",
        ]
    lines += [
        "## Cheat sheet",
        "",
        "| Time | UI | Code | Say |",
        "|------|----|------|-----|",
    ]
    for t, ui, code, say in CHEAT:
        lines.append(f"| {t} | {ui} | `{code}` | {say} |")
    lines += ["", "## Recording tips", ""]
    for tip in TIPS:
        lines.append(f"- {tip}")
    lines.append("")
    return "\n".join(lines)


def build_pdf():
    pdf = ScriptPDF(orientation="P", unit="mm", format="A4")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.set_margins(16, 14, 16)
    pdf.add_page()

    h1(pdf, "FireMe - Demo Video Script (Scaler)")
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(60, 60, 60)
    pdf.multi_cell(0, 6, "~5-6 minutes  |  Kartikeya Krishna Mishra")
    pdf.ln(2)
    pdf.set_draw_color(180, 180, 180)
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
    pdf.ln(4)

    h2(pdf, "Before you record")
    bullet(pdf, "Wake https://fireme-chi.vercel.app until the API is ready.")
    bullet(pdf, "Or check https://fireme.onrender.com/api/health.")
    bullet(pdf, "Primary meeting: Product roadmap sync.")
    bullet(pdf, "Optional real video: WIN 20260723 Pro.")
    bullet(pdf, "GitHub: https://github.com/KartikeyaM2007/fireme")
    pdf.ln(1)

    h2(pdf, "Sections")
    for s in SECTIONS:
        h3(pdf, s["title"])
        label_line(pdf, "Code", s["code"])
        label_line(pdf, "Show", s["show"])
        pdf.set_font("Helvetica", "B", 10.5)
        pdf.set_text_color(35, 35, 35)
        pdf.multi_cell(0, 5.5, f"Say: {s['say']}")
        pdf.ln(1.5)

    h2(pdf, "Cheat sheet")
    # Table header
    col_w = [18, 42, 48, 62]
    headers = ["Time", "UI", "Code", "Say"]
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(240, 240, 240)
    for i, h in enumerate(headers):
        pdf.cell(col_w[i], 7, h, border=1, fill=True)
    pdf.ln()
    pdf.set_font("Helvetica", "", 8.5)
    for row in CHEAT:
        # Estimate row height from wrapping
        x0, y0 = pdf.get_x(), pdf.get_y()
        # Use multi_cell in cells carefully — simplified single-line-ish rows
        heights = []
        for i, cell in enumerate(row):
            heights.append(pdf.get_string_width(cell) / (col_w[i] - 2))
        # Use fixed multi-line approach with max height
        line_h = 4.5
        # Precompute lines needed
        lines_needed = 1
        for i, cell in enumerate(row):
            # rough: wrap at ~chars
            n = max(1, int(pdf.get_string_width(cell) / (col_w[i] - 3)) + 1)
            lines_needed = max(lines_needed, n)
        row_h = line_h * lines_needed + 2
        if pdf.get_y() + row_h > pdf.h - 18:
            pdf.add_page()
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_fill_color(240, 240, 240)
            for i, h in enumerate(headers):
                pdf.cell(col_w[i], 7, h, border=1, fill=True)
            pdf.ln()
            pdf.set_font("Helvetica", "", 8.5)
            y0 = pdf.get_y()
            x0 = pdf.get_x()

        x = pdf.l_margin
        y = pdf.get_y()
        for i, cell in enumerate(row):
            pdf.set_xy(x, y)
            pdf.multi_cell(col_w[i], line_h, cell, border=0)
            # draw border box
            pdf.rect(x, y, col_w[i], row_h)
            x += col_w[i]
        pdf.set_xy(pdf.l_margin, y + row_h)

    pdf.ln(4)
    h2(pdf, "Recording tips")
    for tip in TIPS:
        bullet(pdf, tip)

    pdf.output(str(PDF_PATH))
    print(f"Wrote {PDF_PATH}")


if __name__ == "__main__":
    MD_PATH.write_text(build_md(), encoding="utf-8")
    print(f"Wrote {MD_PATH}")
    build_pdf()
