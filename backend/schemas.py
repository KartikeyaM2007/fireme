from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class SegmentIn(BaseModel):
    speaker: str
    start_seconds: int = 0
    content: str


class SegmentUpdate(BaseModel):
    speaker: Optional[str] = None
    start_seconds: Optional[int] = None
    content: Optional[str] = None


class ActionIn(BaseModel):
    text: str = Field(min_length=1)
    owner: str = "Unassigned"


class ActionUpdate(BaseModel):
    text: Optional[str] = None
    owner: Optional[str] = None
    completed: Optional[bool] = None


class MeetingIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    occurred_at: datetime = Field(default_factory=datetime.now)
    duration_seconds: int = 0
    participants: list[str] = []
    summary: str = ""
    topics: list[str] = []


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class PasteTranscriptIn(BaseModel):
    content: str = Field(min_length=1, max_length=2_000_000)


class NoteIn(BaseModel):
    kind: Literal["comment", "highlight", "soundbite"]
    body: str = ""
    segment_id: Optional[int] = None
    start_seconds: int = 0
    end_seconds: Optional[int] = None
