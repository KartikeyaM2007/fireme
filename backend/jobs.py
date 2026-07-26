"""Background transcription jobs so long media does not block the HTTP request."""
from __future__ import annotations

import threading
from pathlib import Path

from database import SessionLocal
from models import Meeting, TranscriptSegment
from services import transcribe_media
from storage import resolve_local_path

_lock = threading.Lock()
_running: set[int] = set()


def start_transcription(meeting_id: int) -> bool:
    with _lock:
        if meeting_id in _running:
            return False
        _running.add(meeting_id)
    thread = threading.Thread(target=_run_transcription, args=(meeting_id,), daemon=True)
    thread.start()
    return True


def _run_transcription(meeting_id: int) -> None:
    db = SessionLocal()
    try:
        meeting = db.get(Meeting, meeting_id)
        if not meeting or not meeting.media_path:
            return
        meeting.processing_status = "transcribing"
        db.commit()
        try:
            path = resolve_local_path(meeting.media_path, db)
            segments = transcribe_media(Path(path))
            if not segments:
                meeting.processing_status = "awaiting_transcription"
                db.commit()
                return
            meeting.segments = [TranscriptSegment(**row) for row in segments]
            meeting.duration_seconds = max(row["start_seconds"] for row in segments)
            meeting.processing_status = "ready"
            db.commit()
        except Exception:
            meeting.processing_status = "awaiting_transcription"
            db.commit()
    finally:
        db.close()
        with _lock:
            _running.discard(meeting_id)
