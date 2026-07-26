import json
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from database import SessionLocal
from models import ActionItem, Meeting, MeetingQuestion, SegmentNote, TranscriptSegment


def seed() -> None:
    db = SessionLocal()
    if db.scalar(select(Meeting.id).limit(1)):
        db.close()
        return
    samples = [
        (
            "Product roadmap sync",
            2,
            2820,
            ["Maya Chen", "Alex Morgan", "Jordan Lee"],
            "The team aligned on Q3 priorities, making analytics the anchor while retaining activation improvements in the same release.",
            ["Q3 roadmap", "Analytics", "Activation"],
            [(0, "Maya Chen", "Thanks for joining. Today we need to lock the Q3 product priorities."), (38, "Alex Morgan", "The customer interviews point strongly to analytics."), (141, "Maya Chen", "Let us make analytics the anchor.")],
            [("Prepare technical scope for analytics event pipeline", "Jordan Lee"), ("Share customer interview synthesis", "Alex Morgan")],
        ),
        (
            "Weekly design critique",
            5,
            2100,
            ["Priya Shah", "Maya Chen", "Noah Kim"],
            "The group refined the onboarding direction around progressive disclosure and a clearer setup checklist.",
            ["Onboarding", "Design system"],
            [(0, "Priya Shah", "I brought two onboarding directions."), (49, "Noah Kim", "The checklist version gives users confidence."), (111, "Maya Chen", "Can we simplify the first screen?")],
            [("Revise onboarding flow", "Priya Shah")],
        ),
    ]
    for title, days, duration, people, summary, topics, segments, actions in samples:
        meeting = Meeting(
            title=title,
            occurred_at=datetime.now() - timedelta(days=days),
            duration_seconds=duration,
            participants=json.dumps(people),
            summary=summary,
            topics=json.dumps(topics),
            chapters=json.dumps([]),
            processing_status="ready",
        )
        meeting.segments = [TranscriptSegment(speaker=s, start_seconds=t, content=c) for t, s, c in segments]
        meeting.actions = [ActionItem(text=t, owner=o) for t, o in actions]
        db.add(meeting)
    db.commit()
    db.close()


def _attach_demo_extras(meeting: Meeting) -> None:
    """Killer 3-minute demo: soundbite + Ask history on Product roadmap sync."""
    if meeting.title != "Product roadmap sync":
        return
    if not meeting.notes:
        meeting.notes.append(
            SegmentNote(
                kind="soundbite",
                body="Analytics is the most repeated request across segments.",
                start_seconds=38,
                end_seconds=68,
            )
        )
    if not meeting.questions:
        meeting.questions.append(
            MeetingQuestion(
                question="What did we decide about analytics?",
                answer=(
                    "The team decided to make analytics the anchor for the Q3 release [02:21], "
                    "while keeping activation improvements in the same milestone [02:21]. "
                    "Jordan will prepare technical scope by Thursday [01:22]."
                ),
            )
        )


def enrich_demo_meetings(db: Session, user_id: str) -> None:
    """Backfill demo extras for existing accounts that already have starter meetings."""
    rows = list(
        db.scalars(
            select(Meeting)
            .where(
                Meeting.owner_id == user_id,
                Meeting.title == "Product roadmap sync",
            )
            .options(
                selectinload(Meeting.notes),
                selectinload(Meeting.questions),
            )
        ).all()
    )
    changed = False
    for meeting in rows:
        before_notes = len(meeting.notes or [])
        before_q = len(meeting.questions or [])
        _attach_demo_extras(meeting)
        if len(meeting.notes or []) > before_notes or len(meeting.questions or []) > before_q:
            changed = True
    if changed:
        db.commit()


def provision_starter_meetings(db: Session, user_id: str) -> None:
    owned = list(db.scalars(select(Meeting).where(Meeting.owner_id == user_id)).all())
    if owned:
        thin = all((m.summary or "").startswith("Starter meeting") for m in owned)
        if thin and len(owned) <= 2:
            for meeting in owned:
                db.delete(meeting)
            db.commit()
        else:
            enrich_demo_meetings(db, user_id)
            return
    samples = [
        (
            "Product roadmap sync",
            2,
            2820,
            ["Maya Chen", "Alex Morgan", "Jordan Lee"],
            "The team aligned on Q3 priorities, making analytics the anchor while retaining activation improvements in the same release.",
            ["Q3 roadmap", "Analytics", "Activation"],
            [
                {"title": "Priorities", "start_seconds": 0, "summary": "Lock Q3 product priorities."},
                {"title": "Customer signal", "start_seconds": 38, "summary": "Analytics is the strongest repeated request."},
                {"title": "Decision", "start_seconds": 141, "summary": "Analytics anchors the release."},
            ],
            [
                (0, "Maya Chen", "Thanks for joining. Today we need to lock the Q3 product priorities."),
                (38, "Alex Morgan", "The customer interviews point strongly to analytics. It is the most repeated request across segments."),
                (82, "Jordan Lee", "I can have a scoped technical proposal ready by Thursday, including the event pipeline changes."),
                (141, "Maya Chen", "Let us make analytics the anchor and keep activation improvements in the same release."),
                (208, "Alex Morgan", "I will share the interview synthesis and update the roadmap narrative for leadership."),
            ],
            [("Prepare technical scope for analytics event pipeline", "Jordan Lee"), ("Share customer interview synthesis", "Alex Morgan")],
        ),
        (
            "Weekly design critique",
            5,
            2100,
            ["Priya Shah", "Maya Chen", "Noah Kim"],
            "The group refined the onboarding direction around progressive disclosure and a clearer setup checklist.",
            ["Onboarding", "Design system"],
            [
                {"title": "Directions", "start_seconds": 0, "summary": "Two onboarding directions reviewed."},
                {"title": "Checklist", "start_seconds": 49, "summary": "Checklist version builds user confidence."},
            ],
            [
                (0, "Priya Shah", "I brought two onboarding directions based on the usability sessions."),
                (49, "Noah Kim", "The checklist version gives users much better confidence about what happens next."),
                (111, "Maya Chen", "Can we simplify the first screen and move advanced options later?"),
            ],
            [("Revise onboarding flow", "Priya Shah")],
        ),
    ]
    for title, days, duration, people, summary, topics, chapters, segments, actions in samples:
        meeting = Meeting(
            owner_id=user_id,
            title=title,
            occurred_at=datetime.now() - timedelta(days=days),
            duration_seconds=duration,
            participants=json.dumps(people),
            summary=summary,
            topics=json.dumps(topics),
            chapters=json.dumps(chapters),
            processing_status="ready",
        )
        meeting.segments = [TranscriptSegment(start_seconds=t, speaker=s, content=c) for t, s, c in segments]
        meeting.actions = [ActionItem(text=t, owner=o) for t, o in actions]
        _attach_demo_extras(meeting)
        db.add(meeting)
    db.commit()
