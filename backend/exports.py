from fpdf import FPDF

from models import Meeting


def export_text(m: Meeting) -> str:
    lines = [
        f"# {m.title}",
        f"Date: {m.occurred_at.isoformat()}",
        "",
        "## Summary",
        m.summary or "No summary yet.",
        "",
        "## Action items",
    ]
    lines += [f"- [{'x' if a.completed else ' '}] {a.text} ({a.owner})" for a in m.actions] or ["- None"]
    lines += ["", "## Transcript"] + [
        f"[{s.start_seconds // 60:02d}:{s.start_seconds % 60:02d}] {s.speaker}: {s.content}" for s in m.segments
    ]
    return "\n".join(lines)


def export_pdf_bytes(m: Meeting) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_margins(15, 15, 15)

    def write(text: str, size: int = 11, style: str = ""):
        pdf.set_font("Helvetica", style, size)
        safe = (text or "").encode("latin-1", "replace").decode("latin-1")
        pdf.multi_cell(w=pdf.epw, h=6, text=safe)
        pdf.ln(1)

    write(m.title, 16, "B")
    write(f"Date: {m.occurred_at.isoformat()}", 10)
    pdf.ln(2)
    write("Summary", 13, "B")
    write(m.summary or "No summary yet.")
    pdf.ln(2)
    write("Action items", 13, "B")
    if m.actions:
        for action in m.actions:
            write(f"[{'x' if action.completed else ' '}] {action.text} ({action.owner})")
    else:
        write("None")
    pdf.ln(2)
    write("Transcript", 13, "B")
    for segment in m.segments:
        write(
            f"[{segment.start_seconds // 60:02d}:{segment.start_seconds % 60:02d}] {segment.speaker}: {segment.content}",
            10,
        )
    out = pdf.output()
    return out if isinstance(out, (bytes, bytearray)) else bytes(out)
