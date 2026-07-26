import json
import mimetypes
import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy import or_, select, text
from sqlalchemy.orm import Session

from auth import current_user, media_user
from database import Base, engine, ensure_schema, get_db
from exports import export_pdf_bytes, export_text
from jobs import start_transcription
from models import ActionItem, Meeting, MeetingQuestion, SegmentNote, TranscriptSegment
from schemas import (
    ActionIn,
    ActionUpdate,
    AskIn,
    MeetingIn,
    NoteIn,
    PasteTranscriptIn,
    SegmentIn,
    SegmentUpdate,
)
from seed import provision_starter_meetings, seed
from serialize import get_meeting_or_404, serialise
from services import (
    MEDIA_EXTENSIONS,
    TEXT_EXTENSIONS,
    answer_question,
    generate_insights,
    parse_transcript,
)
from storage import delete_media, resolve_local_path, save_bytes, storage_backend

load_dotenv(Path(__file__).with_name(".env"))

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(50 * 1024 * 1024)))


def add_missing_columns():
    with engine.begin() as conn:
        if engine.dialect.name == "sqlite":
            existing = {row[1] for row in conn.exec_driver_sql("PRAGMA table_info(meetings)")}
            for name, definition in {
                "owner_id": "VARCHAR(128)",
                "chapters": "TEXT DEFAULT '[]'",
                "media_path": "VARCHAR(500)",
                "media_type": "VARCHAR(100)",
                "processing_status": "VARCHAR(40) DEFAULT 'ready'",
                "processing_error": "TEXT",
            }.items():
                if name not in existing:
                    conn.exec_driver_sql(f"ALTER TABLE meetings ADD COLUMN {name} {definition}")
            conn.exec_driver_sql(
                "CREATE INDEX IF NOT EXISTS ix_meetings_owner_id ON meetings (owner_id)"
            )
        else:
            conn.exec_driver_sql(
                "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS processing_error TEXT"
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    add_missing_columns()
    ensure_schema()
    if os.getenv("SEED_DEMO_DATA", "true").lower() in {"1", "true", "yes"}:
        seed()
    yield


app = FastAPI(title="FireMe API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        x.strip()
        for x in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
        if x.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health(response: Response):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        database = "ok"
    except Exception:
        response.status_code = 503
        database = "error"
    return {
        "ok": database == "ok",
        "database": database,
        "ai_configured": bool(os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")),
        "ai_provider": os.getenv("AI_PROVIDER", "groq" if os.getenv("GROQ_API_KEY") else "openai"),
        "storage": storage_backend(),
    }


@app.get("/api/meetings")
def list_meetings(
    query: str = "",
    participant: str = "",
    topic: str = "",
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort: str = "recent",
    user_id: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    provision_starter_meetings(db, user_id)
    stmt = select(Meeting).where(Meeting.owner_id == user_id)
    if query:
        like = f"%{query}%"
        transcript_hits = select(TranscriptSegment.meeting_id).where(TranscriptSegment.content.ilike(like))
        stmt = stmt.where(
            or_(
                Meeting.title.ilike(like),
                Meeting.participants.ilike(like),
                Meeting.topics.ilike(like),
                Meeting.summary.ilike(like),
                Meeting.id.in_(transcript_hits),
            )
        )
    if participant:
        stmt = stmt.where(Meeting.participants.ilike(f"%{participant}%"))
    if topic:
        stmt = stmt.where(Meeting.topics.ilike(f"%{topic}%"))
    if date_from:
        stmt = stmt.where(Meeting.occurred_at >= date_from)
    if date_to:
        stmt = stmt.where(Meeting.occurred_at <= date_to)
    stmt = stmt.order_by(Meeting.occurred_at.asc() if sort == "oldest" else Meeting.occurred_at.desc())
    return [serialise(x) for x in db.scalars(stmt).all()]


@app.get("/api/meetings/{meeting_id}")
def get_meeting(meeting_id: int, user_id: str = Depends(current_user), db: Session = Depends(get_db)):
    return serialise(get_meeting_or_404(meeting_id, user_id, db, True), True)


@app.post("/api/meetings", status_code=201)
def create_meeting(payload: MeetingIn, user_id: str = Depends(current_user), db: Session = Depends(get_db)):
    meeting = Meeting(
        owner_id=user_id,
        title=payload.title,
        occurred_at=payload.occurred_at,
        duration_seconds=payload.duration_seconds,
        participants=json.dumps(payload.participants),
        summary=payload.summary,
        topics=json.dumps(payload.topics),
        chapters="[]",
        processing_status="ready" if payload.summary else "awaiting_transcript",
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return serialise(meeting)


@app.put("/api/meetings/{meeting_id}")
def update_meeting(
    meeting_id: int, payload: MeetingIn, user_id: str = Depends(current_user), db: Session = Depends(get_db)
):
    meeting = get_meeting_or_404(meeting_id, user_id, db)
    meeting.title = payload.title
    meeting.occurred_at = payload.occurred_at
    meeting.duration_seconds = payload.duration_seconds
    meeting.participants = json.dumps(payload.participants)
    meeting.summary = payload.summary
    meeting.topics = json.dumps(payload.topics)
    db.commit()
    db.refresh(meeting)
    return serialise(meeting)


@app.delete("/api/meetings/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: int, user_id: str = Depends(current_user), db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(meeting_id, user_id, db)
    delete_media(db, meeting.media_path)
    db.delete(meeting)
    db.commit()
    return Response(status_code=204)


@app.post("/api/meetings/import", status_code=201)
def import_meeting(
    title: str = Form(...),
    participants: str = Form(""),
    file: UploadFile = File(...),
    user_id: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in TEXT_EXTENSIONS | MEDIA_EXTENSIONS:
        raise HTTPException(415, "Upload .txt, .vtt, .srt, .json, .mp3, .mp4, .m4a, .wav, .webm, .ogg, or .flac")
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = file.file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"Upload exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit")
        chunks.append(chunk)
    raw = b"".join(chunks)
    people = [x.strip() for x in participants.split(",") if x.strip()]
    if ext in TEXT_EXTENSIONS:
        segments = parse_transcript(raw.decode("utf-8-sig"), ext)
        if not segments:
            raise HTTPException(422, "No readable transcript segments found")
        meeting = Meeting(
            owner_id=user_id,
            title=title,
            participants=json.dumps(people),
            duration_seconds=max(x["start_seconds"] for x in segments),
            chapters="[]",
            processing_status="ready",
        )
        meeting.segments = [TranscriptSegment(**x) for x in segments]
    else:
        key = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}{ext}"
        content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0]
        stored = save_bytes(db, key, raw, content_type)
        meeting = Meeting(
            owner_id=user_id,
            title=title,
            participants=json.dumps(people),
            chapters="[]",
            media_path=stored,
            media_type=content_type,
            processing_status="awaiting_transcription",
        )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return serialise(meeting)


@app.post("/api/meetings/{meeting_id}/segments", status_code=201)
def add_segment(
    meeting_id: int, payload: SegmentIn, user_id: str = Depends(current_user), db: Session = Depends(get_db)
):
    get_meeting_or_404(meeting_id, user_id, db)
    segment = TranscriptSegment(meeting_id=meeting_id, **payload.model_dump())
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return {
        "id": segment.id,
        "speaker": segment.speaker,
        "start_seconds": segment.start_seconds,
        "content": segment.content,
    }


@app.post("/api/meetings/{meeting_id}/paste-transcript", status_code=201)
def paste_transcript(
    meeting_id: int,
    payload: PasteTranscriptIn,
    user_id: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    meeting = get_meeting_or_404(meeting_id, user_id, db, True)
    segments = parse_transcript(payload.content, ".txt")
    if not segments:
        raise HTTPException(422, "No readable transcript segments found")
    meeting.segments = [TranscriptSegment(**x) for x in segments]
    meeting.duration_seconds = max(x["start_seconds"] for x in segments)
    meeting.processing_status = "ready"
    db.commit()
    return serialise(get_meeting_or_404(meeting_id, user_id, db, True), True)


@app.patch("/api/segments/{segment_id}")
def update_segment(
    segment_id: int, payload: SegmentUpdate, user_id: str = Depends(current_user), db: Session = Depends(get_db)
):
    segment = db.scalar(
        select(TranscriptSegment)
        .join(Meeting)
        .where(TranscriptSegment.id == segment_id, Meeting.owner_id == user_id)
    )
    if not segment:
        raise HTTPException(404, "Transcript segment not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(segment, key, value)
    db.commit()
    db.refresh(segment)
    return {
        "id": segment.id,
        "speaker": segment.speaker,
        "start_seconds": segment.start_seconds,
        "content": segment.content,
    }


@app.delete("/api/segments/{segment_id}", status_code=204)
def delete_segment(segment_id: int, user_id: str = Depends(current_user), db: Session = Depends(get_db)):
    segment = db.scalar(
        select(TranscriptSegment)
        .join(Meeting)
        .where(TranscriptSegment.id == segment_id, Meeting.owner_id == user_id)
    )
    if not segment:
        raise HTTPException(404, "Transcript segment not found")
    db.delete(segment)
    db.commit()
    return Response(status_code=204)


@app.post("/api/meetings/{meeting_id}/actions", status_code=201)
def create_action(
    meeting_id: int, payload: ActionIn, user_id: str = Depends(current_user), db: Session = Depends(get_db)
):
    get_meeting_or_404(meeting_id, user_id, db)
    action = ActionItem(meeting_id=meeting_id, **payload.model_dump())
    db.add(action)
    db.commit()
    db.refresh(action)
    return {"id": action.id, "text": action.text, "owner": action.owner, "completed": action.completed}


@app.patch("/api/actions/{action_id}")
def update_action(
    action_id: int, payload: ActionUpdate, user_id: str = Depends(current_user), db: Session = Depends(get_db)
):
    action = db.scalar(
        select(ActionItem).join(Meeting).where(ActionItem.id == action_id, Meeting.owner_id == user_id)
    )
    if not action:
        raise HTTPException(404, "Action item not found")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(action, key, value)
    db.commit()
    db.refresh(action)
    return {"id": action.id, "text": action.text, "owner": action.owner, "completed": action.completed}


@app.delete("/api/actions/{action_id}", status_code=204)
def delete_action(action_id: int, user_id: str = Depends(current_user), db: Session = Depends(get_db)):
    action = db.scalar(
        select(ActionItem).join(Meeting).where(ActionItem.id == action_id, Meeting.owner_id == user_id)
    )
    if not action:
        raise HTTPException(404, "Action item not found")
    db.delete(action)
    db.commit()
    return Response(status_code=204)


@app.post("/api/meetings/{meeting_id}/notes", status_code=201)
def create_note(
    meeting_id: int, payload: NoteIn, user_id: str = Depends(current_user), db: Session = Depends(get_db)
):
    get_meeting_or_404(meeting_id, user_id, db)
    if payload.segment_id:
        segment = db.scalar(
            select(TranscriptSegment).where(
                TranscriptSegment.id == payload.segment_id, TranscriptSegment.meeting_id == meeting_id
            )
        )
        if not segment:
            raise HTTPException(404, "Transcript segment not found")
    note = SegmentNote(meeting_id=meeting_id, **payload.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return {
        "id": note.id,
        "kind": note.kind,
        "body": note.body,
        "segment_id": note.segment_id,
        "start_seconds": note.start_seconds,
        "end_seconds": note.end_seconds,
    }


@app.delete("/api/notes/{note_id}", status_code=204)
def delete_note(note_id: int, user_id: str = Depends(current_user), db: Session = Depends(get_db)):
    note = db.scalar(select(SegmentNote).join(Meeting).where(SegmentNote.id == note_id, Meeting.owner_id == user_id))
    if not note:
        raise HTTPException(404, "Note not found")
    db.delete(note)
    db.commit()
    return Response(status_code=204)


@app.post("/api/meetings/{meeting_id}/generate-insights")
def insights(meeting_id: int, user_id: str = Depends(current_user), db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(meeting_id, user_id, db, True)
    meeting.processing_status = "processing"
    db.commit()
    try:
        result = generate_insights(meeting.segments)
    except Exception:
        meeting.processing_status = "ready"
        db.commit()
        raise
    meeting.summary = str(result.get("summary", "")).strip()
    meeting.topics = json.dumps(result.get("topics", []))
    meeting.chapters = json.dumps(result.get("chapters", []))
    meeting.actions = [
        ActionItem(text=x.get("text", ""), owner=x.get("owner", "Unassigned"))
        for x in result.get("actions", [])
        if x.get("text")
    ]
    meeting.processing_status = "ready"
    db.commit()
    return serialise(get_meeting_or_404(meeting_id, user_id, db, True), True)


@app.post("/api/meetings/{meeting_id}/transcribe")
def transcribe(meeting_id: int, user_id: str = Depends(current_user), db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(meeting_id, user_id, db, True)
    if not meeting.media_path:
        raise HTTPException(422, "This meeting has no recording to transcribe")
    try:
        resolve_local_path(meeting.media_path, db)
    except FileNotFoundError:
        raise HTTPException(404, "The recording file is missing") from None
    meeting.processing_status = "transcribing"
    meeting.processing_error = None
    db.commit()
    start_transcription(meeting_id)
    return serialise(get_meeting_or_404(meeting_id, user_id, db, True), True)


@app.post("/api/meetings/{meeting_id}/ask")
def ask(meeting_id: int, payload: AskIn, user_id: str = Depends(current_user), db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(meeting_id, user_id, db, True)
    answer = answer_question(meeting.segments, payload.question)
    row = MeetingQuestion(meeting_id=meeting_id, question=payload.question, answer=answer)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "id": row.id,
        "question": row.question,
        "answer": row.answer,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@app.get("/api/meetings/{meeting_id}/media")
def meeting_media(meeting_id: int, user_id: str = Depends(media_user), db: Session = Depends(get_db)):
    meeting = get_meeting_or_404(meeting_id, user_id, db)
    if not meeting.media_path:
        raise HTTPException(404, "This meeting has no recording")
    try:
        path = resolve_local_path(meeting.media_path, db)
    except FileNotFoundError:
        raise HTTPException(404, "The recording file is missing") from None
    return FileResponse(path, media_type=meeting.media_type or "application/octet-stream")


@app.get("/api/meetings/{meeting_id}/export")
def export(
    meeting_id: int,
    format: str = "markdown",
    user_id: str = Depends(current_user),
    db: Session = Depends(get_db),
):
    meeting = get_meeting_or_404(meeting_id, user_id, db, True)
    fmt = (format or "markdown").lower()
    if fmt not in {"markdown", "txt", "pdf"}:
        raise HTTPException(422, "format must be markdown, txt, or pdf")
    if fmt == "pdf":
        return Response(
            content=bytes(export_pdf_bytes(meeting)),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="meeting-{meeting.id}.pdf"'},
        )
    body = export_text(meeting)
    media = "text/markdown" if fmt == "markdown" else "text/plain"
    suffix = "md" if fmt == "markdown" else "txt"
    return PlainTextResponse(
        body,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="meeting-{meeting.id}.{suffix}"'},
    )
