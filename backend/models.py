from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Meeting(Base):
    __tablename__ = "meetings"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[str | None] = mapped_column(String(128), index=True, nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    participants: Mapped[str] = mapped_column(Text, default="[]")
    summary: Mapped[str] = mapped_column(Text, default="")
    topics: Mapped[str] = mapped_column(Text, default="[]")
    chapters: Mapped[str] = mapped_column(Text, default="[]")
    media_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    media_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    processing_status: Mapped[str] = mapped_column(String(40), default="ready")
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    segments: Mapped[list["TranscriptSegment"]] = relationship(
        cascade="all, delete-orphan", back_populates="meeting", order_by="TranscriptSegment.start_seconds"
    )
    actions: Mapped[list["ActionItem"]] = relationship(cascade="all, delete-orphan", back_populates="meeting")
    questions: Mapped[list["MeetingQuestion"]] = relationship(cascade="all, delete-orphan", back_populates="meeting")
    notes: Mapped[list["SegmentNote"]] = relationship(cascade="all, delete-orphan", back_populates="meeting")


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"))
    speaker: Mapped[str] = mapped_column(String(100))
    start_seconds: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    meeting: Mapped[Meeting] = relationship(back_populates="segments")
    notes: Mapped[list["SegmentNote"]] = relationship(cascade="all, delete-orphan", back_populates="segment")


class ActionItem(Base):
    __tablename__ = "action_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"))
    text: Mapped[str] = mapped_column(Text)
    owner: Mapped[str] = mapped_column(String(100), default="Unassigned")
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    meeting: Mapped[Meeting] = relationship(back_populates="actions")


class MeetingQuestion(Base):
    __tablename__ = "meeting_questions"
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    meeting: Mapped[Meeting] = relationship(back_populates="questions")


class SegmentNote(Base):
    """Comments, highlights, and soundbites on transcript moments."""

    __tablename__ = "segment_notes"
    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), index=True)
    segment_id: Mapped[int | None] = mapped_column(ForeignKey("transcript_segments.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(20))  # comment | highlight | soundbite
    body: Mapped[str] = mapped_column(Text, default="")
    start_seconds: Mapped[int] = mapped_column(Integer, default=0)
    end_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    meeting: Mapped[Meeting] = relationship(back_populates="notes")
    segment: Mapped[TranscriptSegment | None] = relationship(back_populates="notes")


class MediaBlob(Base):
    """Durable upload bytes when not using ephemeral local disk alone."""

    __tablename__ = "media_blobs"
    key: Mapped[str] = mapped_column(String(500), primary_key=True)
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
