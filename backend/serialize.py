import json

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from models import Meeting


def serialise(m: Meeting, detail: bool = False):
    item = {
        "id": m.id,
        "title": m.title,
        "occurred_at": m.occurred_at,
        "duration_seconds": m.duration_seconds,
        "participants": json.loads(m.participants),
        "summary": m.summary,
        "topics": json.loads(m.topics),
        "chapters": json.loads(m.chapters or "[]"),
        "processing_status": m.processing_status,
        "processing_error": getattr(m, "processing_error", None),
        "media_url": f"/api/meetings/{m.id}/media" if m.media_path else None,
        "media_type": m.media_type,
    }
    if detail:
        item["segments"] = [
            {
                "id": x.id,
                "speaker": x.speaker,
                "start_seconds": x.start_seconds,
                "content": x.content,
            }
            for x in m.segments
        ]
        item["actions"] = [
            {"id": x.id, "text": x.text, "owner": x.owner, "completed": x.completed}
            for x in m.actions
        ]
        item["notes"] = [
            {
                "id": n.id,
                "kind": n.kind,
                "body": n.body,
                "segment_id": n.segment_id,
                "start_seconds": n.start_seconds,
                "end_seconds": n.end_seconds,
            }
            for n in m.notes
        ]
        item["questions"] = [
            {
                "id": q.id,
                "question": q.question,
                "answer": q.answer,
                "created_at": q.created_at.isoformat() if q.created_at else None,
            }
            for q in sorted(m.questions, key=lambda x: x.id)
        ]
    return item


def get_meeting_or_404(meeting_id: int, owner_id: str, db: Session, detail: bool = False):
    stmt = select(Meeting).where(Meeting.id == meeting_id, Meeting.owner_id == owner_id)
    if detail:
        stmt = stmt.options(
            selectinload(Meeting.segments),
            selectinload(Meeting.actions),
            selectinload(Meeting.notes),
            selectinload(Meeting.questions),
        )
    meeting = db.scalar(stmt)
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return meeting
