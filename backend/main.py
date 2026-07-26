import json
import mimetypes
import os
import shutil
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload
import jwt
from jwt import PyJWKClient

from database import Base, engine, get_db, SessionLocal
from models import ActionItem, Meeting, MeetingQuestion, TranscriptSegment
from services import MEDIA_EXTENSIONS, TEXT_EXTENSIONS, UPLOAD_DIR, answer_question, generate_insights, parse_transcript, transcribe_media

load_dotenv(Path(__file__).with_name(".env"))

class SegmentIn(BaseModel): speaker:str; start_seconds:int=0; content:str
class SegmentUpdate(BaseModel): speaker:Optional[str]=None; start_seconds:Optional[int]=None; content:Optional[str]=None
class ActionIn(BaseModel): text:str=Field(min_length=1); owner:str="Unassigned"
class ActionUpdate(BaseModel): text:Optional[str]=None; owner:Optional[str]=None; completed:Optional[bool]=None
class MeetingIn(BaseModel):
    title:str=Field(min_length=1,max_length=200); occurred_at:datetime=Field(default_factory=datetime.now); duration_seconds:int=0; participants:list[str]=[]; summary:str=""; topics:list[str]=[]
class AskIn(BaseModel): question:str=Field(min_length=1,max_length=2000)
class PasteTranscriptIn(BaseModel): content:str=Field(min_length=1,max_length=2_000_000)

MAX_UPLOAD_BYTES=int(os.getenv("MAX_UPLOAD_BYTES",str(50*1024*1024)))

_jwks_client: PyJWKClient | None = None
def current_user(authorization: str | None = Header(default=None)) -> str:
    """Verify a Clerk session JWT and return its immutable Clerk user id."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401,"Authentication required")
    token=authorization.removeprefix("Bearer ").strip()
    jwks_url=os.getenv("CLERK_JWKS_URL")
    issuer=os.getenv("CLERK_ISSUER")
    if not jwks_url or not issuer:
        raise HTTPException(503,"Clerk verification is not configured. Set CLERK_JWKS_URL and CLERK_ISSUER in backend/.env")
    try:
        global _jwks_client
        _jwks_client=_jwks_client or PyJWKClient(jwks_url)
        key=_jwks_client.get_signing_key_from_jwt(token).key
        claims=jwt.decode(token,key,algorithms=["RS256"],issuer=issuer,options={"verify_aud":False})
        allowed={x.strip() for x in os.getenv("CLERK_AUTHORIZED_PARTIES","http://localhost:3000").split(",") if x.strip()}
        if allowed and claims.get("azp") not in allowed: raise ValueError("untrusted authorized party")
        user_id=str(claims.get("sub","")).strip()
        if not user_id: raise ValueError("missing subject")
        return user_id
    except HTTPException: raise
    except Exception as exc: raise HTTPException(401,"Invalid or expired Clerk session") from exc

def add_missing_columns():
    # Lightweight SQLite migration for existing assignment databases.
    if engine.dialect.name != "sqlite": return
    with engine.begin() as conn:
        existing={row[1] for row in conn.exec_driver_sql("PRAGMA table_info(meetings)")}
        for name, definition in {"owner_id":"VARCHAR(128)","chapters":"TEXT DEFAULT '[]'","media_path":"VARCHAR(500)","media_type":"VARCHAR(100)","processing_status":"VARCHAR(40) DEFAULT 'ready'"}.items():
            if name not in existing: conn.exec_driver_sql(f"ALTER TABLE meetings ADD COLUMN {name} {definition}")
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS ix_meetings_owner_id ON meetings (owner_id)")

def serialise(m:Meeting,detail=False):
    item={"id":m.id,"title":m.title,"occurred_at":m.occurred_at,"duration_seconds":m.duration_seconds,"participants":json.loads(m.participants),"summary":m.summary,"topics":json.loads(m.topics),"chapters":json.loads(m.chapters or "[]"),"processing_status":m.processing_status,"media_url":f"/api/meetings/{m.id}/media" if m.media_path else None,"media_type":m.media_type}
    if detail:
        item["segments"]=[{"id":x.id,"speaker":x.speaker,"start_seconds":x.start_seconds,"content":x.content} for x in m.segments]
        item["actions"]=[{"id":x.id,"text":x.text,"owner":x.owner,"completed":x.completed} for x in m.actions]
    return item

def get_meeting_or_404(meeting_id:int,owner_id:str,db:Session, detail=False):
    stmt=select(Meeting).where(Meeting.id==meeting_id,Meeting.owner_id==owner_id)
    if detail: stmt=stmt.options(selectinload(Meeting.segments),selectinload(Meeting.actions))
    m=db.scalar(stmt)
    if not m: raise HTTPException(404,"Meeting not found")
    return m

def seed():
    db=SessionLocal()
    if db.scalar(select(Meeting.id).limit(1)): db.close(); return
    samples=[("Product roadmap sync",2,2820,["Maya Chen","Alex Morgan","Jordan Lee"],"The team aligned on Q3 priorities, making analytics the anchor while retaining activation improvements in the same release.",["Q3 roadmap","Analytics","Activation"],[(0,"Maya Chen","Thanks for joining. Today we need to lock the Q3 product priorities."),(38,"Alex Morgan","The customer interviews point strongly to analytics. It is the most repeated request across segments."),(82,"Jordan Lee","I can have a scoped technical proposal ready by Thursday, including the event pipeline changes."),(141,"Maya Chen","Let us make analytics the anchor and keep activation improvements in the same release."),(208,"Alex Morgan","I will share the interview synthesis and update the roadmap narrative for leadership.")],[("Prepare technical scope for analytics event pipeline","Jordan Lee"),("Share customer interview synthesis","Alex Morgan")]),("Weekly design critique",5,2100,["Priya Shah","Maya Chen","Noah Kim"],"The group refined the onboarding direction around progressive disclosure and a clearer setup checklist.",["Onboarding","Design system"],[(0,"Priya Shah","I brought two onboarding directions based on the usability sessions."),(49,"Noah Kim","The checklist version gives users much better confidence about what happens next."),(111,"Maya Chen","Can we simplify the first screen and move advanced options later?")],[("Revise onboarding flow","Priya Shah")])]
    for title,days,duration,people,summary,topics,segments,actions in samples:
        m=Meeting(title=title,occurred_at=datetime.now()-timedelta(days=days),duration_seconds=duration,participants=json.dumps(people),summary=summary,topics=json.dumps(topics),chapters=json.dumps([]),processing_status="ready")
        m.segments=[TranscriptSegment(speaker=s,start_seconds=t,content=c) for t,s,c in segments];m.actions=[ActionItem(text=t,owner=o) for t,o in actions];db.add(m)
    db.commit();db.close()

def provision_starter_meetings(db:Session,user_id:str):
    """Give a new authenticated user assignment starter data without sharing legacy rows."""
    if db.scalar(select(Meeting.id).where(Meeting.owner_id==user_id).limit(1)): return
    starter=[("Product roadmap sync",["Maya Chen","Alex Morgan"],[(0,"Maya Chen","Welcome to the roadmap review."),(38,"Alex Morgan","Analytics is the most repeated customer request."),(82,"Maya Chen","We will prioritize analytics for Q3.")]),("Weekly design critique",["Priya Shah","Noah Kim"],[(0,"Priya Shah","I brought two onboarding directions."),(49,"Noah Kim","The checklist gives users confidence."),(111,"Priya Shah","We will simplify the first screen.")])]
    for title,people,segments in starter:
        m=Meeting(owner_id=user_id,title=title,occurred_at=datetime.now(),duration_seconds=segments[-1][0],participants=json.dumps(people),summary="Starter meeting. Generate insights to create a fresh brief.",topics="[]",chapters="[]",processing_status="ready")
        m.segments=[TranscriptSegment(start_seconds=t,speaker=s,content=c) for t,s,c in segments];db.add(m)
    db.commit()

@asynccontextmanager
async def lifespan(app:FastAPI): Base.metadata.create_all(bind=engine);add_missing_columns();seed();yield
app=FastAPI(title="FireMe API",lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=[x for x in os.getenv("CORS_ORIGINS","http://localhost:3000,http://127.0.0.1:3000").split(",")],allow_credentials=True,allow_methods=["*"],allow_headers=["*"])

@app.get("/api/health")
def health(): return {"ok":True,"ai_configured":bool(os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")),"ai_provider":os.getenv("AI_PROVIDER", "groq" if os.getenv("GROQ_API_KEY") else "openai"),"storage":"local"}
@app.get("/api/meetings")
def list_meetings(query:str="",date_from:Optional[datetime]=None,date_to:Optional[datetime]=None,sort:str="recent",user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    provision_starter_meetings(db,user_id)
    stmt=select(Meeting).where(Meeting.owner_id==user_id)
    if query:
        like=f"%{query}%";stmt=stmt.where(or_(Meeting.title.ilike(like),Meeting.participants.ilike(like),Meeting.topics.ilike(like),Meeting.summary.ilike(like)))
    if date_from: stmt=stmt.where(Meeting.occurred_at>=date_from)
    if date_to: stmt=stmt.where(Meeting.occurred_at<=date_to)
    stmt=stmt.order_by(Meeting.occurred_at.asc() if sort=="oldest" else Meeting.occurred_at.desc())
    return [serialise(x) for x in db.scalars(stmt).all()]
@app.get("/api/meetings/{meeting_id}")
def get_meeting(meeting_id:int,user_id:str=Depends(current_user),db:Session=Depends(get_db)): return serialise(get_meeting_or_404(meeting_id,user_id,db,True),True)
@app.post("/api/meetings",status_code=201)
def create_meeting(payload:MeetingIn,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    m=Meeting(owner_id=user_id,title=payload.title,occurred_at=payload.occurred_at,duration_seconds=payload.duration_seconds,participants=json.dumps(payload.participants),summary=payload.summary,topics=json.dumps(payload.topics),chapters="[]",processing_status="ready" if payload.summary else "awaiting_transcript");db.add(m);db.commit();db.refresh(m);return serialise(m)
@app.put("/api/meetings/{meeting_id}")
def update_meeting(meeting_id:int,payload:MeetingIn,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    m=get_meeting_or_404(meeting_id,user_id,db);m.title=payload.title;m.occurred_at=payload.occurred_at;m.duration_seconds=payload.duration_seconds;m.participants=json.dumps(payload.participants);m.summary=payload.summary;m.topics=json.dumps(payload.topics);db.commit();db.refresh(m);return serialise(m)
@app.delete("/api/meetings/{meeting_id}",status_code=204)
def delete_meeting(meeting_id:int,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    m=get_meeting_or_404(meeting_id,user_id,db)
    if m.media_path: (UPLOAD_DIR/m.media_path).unlink(missing_ok=True)
    db.delete(m);db.commit();return Response(status_code=204)
@app.post("/api/meetings/import",status_code=201)
def import_meeting(title:str=Form(...),participants:str=Form(""),file:UploadFile=File(...),user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    ext=Path(file.filename or "").suffix.lower()
    if ext not in TEXT_EXTENSIONS|MEDIA_EXTENSIONS: raise HTTPException(415,"Upload .txt, .vtt, .srt, .json, .mp3, .mp4, .m4a, .wav, .webm, .ogg, or .flac")
    safe=f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}{ext}";target=UPLOAD_DIR/safe
    total=0
    try:
        with target.open("wb") as out:
            while chunk:=file.file.read(1024*1024):
                total+=len(chunk)
                if total>MAX_UPLOAD_BYTES: raise HTTPException(413,f"Upload exceeds the {MAX_UPLOAD_BYTES//(1024*1024)} MB limit")
                out.write(chunk)
    except Exception:
        target.unlink(missing_ok=True);raise
    people=[x.strip() for x in participants.split(",") if x.strip()]
    if ext in TEXT_EXTENSIONS:
        segments=parse_transcript(target.read_text(encoding="utf-8-sig"),ext);target.unlink(missing_ok=True)
        if not segments: raise HTTPException(422,"No readable transcript segments found")
        m=Meeting(owner_id=user_id,title=title,participants=json.dumps(people),duration_seconds=max(x["start_seconds"] for x in segments),chapters="[]",processing_status="ready")
        m.segments=[TranscriptSegment(**x) for x in segments]
    else:
        m=Meeting(owner_id=user_id,title=title,participants=json.dumps(people),chapters="[]",media_path=safe,media_type=file.content_type or mimetypes.guess_type(file.filename or "")[0],processing_status="awaiting_transcription")
    db.add(m);db.commit();db.refresh(m);return serialise(m)
@app.post("/api/meetings/{meeting_id}/segments",status_code=201)
def add_segment(meeting_id:int,payload:SegmentIn,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    get_meeting_or_404(meeting_id,user_id,db);s=TranscriptSegment(meeting_id=meeting_id,**payload.model_dump());db.add(s);db.commit();db.refresh(s);return {"id":s.id,"speaker":s.speaker,"start_seconds":s.start_seconds,"content":s.content}
@app.post("/api/meetings/{meeting_id}/paste-transcript",status_code=201)
def paste_transcript(meeting_id:int,payload:PasteTranscriptIn,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    m=get_meeting_or_404(meeting_id,user_id,db,True);segments=parse_transcript(payload.content,".txt")
    if not segments: raise HTTPException(422,"No readable transcript segments found")
    m.segments=[TranscriptSegment(**x) for x in segments];m.duration_seconds=max(x["start_seconds"] for x in segments);m.processing_status="ready";db.commit();return serialise(get_meeting_or_404(meeting_id,user_id,db,True),True)
@app.patch("/api/segments/{segment_id}")
def update_segment(segment_id:int,payload:SegmentUpdate,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    s=db.scalar(select(TranscriptSegment).join(Meeting).where(TranscriptSegment.id==segment_id,Meeting.owner_id==user_id))
    if not s: raise HTTPException(404,"Transcript segment not found")
    for k,v in payload.model_dump(exclude_none=True).items():setattr(s,k,v)
    db.commit();db.refresh(s);return {"id":s.id,"speaker":s.speaker,"start_seconds":s.start_seconds,"content":s.content}
@app.delete("/api/segments/{segment_id}",status_code=204)
def delete_segment(segment_id:int,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    s=db.scalar(select(TranscriptSegment).join(Meeting).where(TranscriptSegment.id==segment_id,Meeting.owner_id==user_id))
    if not s: raise HTTPException(404,"Transcript segment not found")
    db.delete(s);db.commit();return Response(status_code=204)
@app.post("/api/meetings/{meeting_id}/actions",status_code=201)
def create_action(meeting_id:int,payload:ActionIn,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    get_meeting_or_404(meeting_id,user_id,db);a=ActionItem(meeting_id=meeting_id,**payload.model_dump());db.add(a);db.commit();db.refresh(a);return {"id":a.id,"text":a.text,"owner":a.owner,"completed":a.completed}
@app.patch("/api/actions/{action_id}")
def update_action(action_id:int,payload:ActionUpdate,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    a=db.scalar(select(ActionItem).join(Meeting).where(ActionItem.id==action_id,Meeting.owner_id==user_id))
    if not a: raise HTTPException(404,"Action item not found")
    for k,v in payload.model_dump(exclude_none=True).items():setattr(a,k,v)
    db.commit();db.refresh(a);return {"id":a.id,"text":a.text,"owner":a.owner,"completed":a.completed}
@app.delete("/api/actions/{action_id}",status_code=204)
def delete_action(action_id:int,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    a=db.scalar(select(ActionItem).join(Meeting).where(ActionItem.id==action_id,Meeting.owner_id==user_id))
    if not a: raise HTTPException(404,"Action item not found")
    db.delete(a);db.commit();return Response(status_code=204)
@app.post("/api/meetings/{meeting_id}/generate-insights")
def insights(meeting_id:int,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    m=get_meeting_or_404(meeting_id,user_id,db,True);m.processing_status="processing";db.commit()
    try: result=generate_insights(m.segments)
    except Exception: m.processing_status="ready";db.commit();raise
    m.summary=str(result.get("summary","")).strip();m.topics=json.dumps(result.get("topics",[]));m.chapters=json.dumps(result.get("chapters",[]));m.actions=[ActionItem(text=x.get("text",""),owner=x.get("owner","Unassigned")) for x in result.get("actions",[]) if x.get("text")];m.processing_status="ready";db.commit();return serialise(get_meeting_or_404(meeting_id,user_id,db,True),True)
@app.post("/api/meetings/{meeting_id}/transcribe")
def transcribe(meeting_id:int,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    m=get_meeting_or_404(meeting_id,user_id,db,True)
    if not m.media_path: raise HTTPException(422,"This meeting has no recording to transcribe")
    media=UPLOAD_DIR/m.media_path
    if not media.exists(): raise HTTPException(404,"The recording file is missing")
    m.processing_status="transcribing";db.commit()
    try: segments=transcribe_media(media)
    except Exception: m.processing_status="awaiting_transcription";db.commit();raise
    if not segments: m.processing_status="awaiting_transcription";db.commit();raise HTTPException(502,"The transcription service returned no text")
    m.segments=[TranscriptSegment(**x) for x in segments];m.duration_seconds=max(x["start_seconds"] for x in segments);m.processing_status="ready";db.commit();return serialise(get_meeting_or_404(meeting_id,user_id,db,True),True)
@app.post("/api/meetings/{meeting_id}/ask")
def ask(meeting_id:int,payload:AskIn,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    m=get_meeting_or_404(meeting_id,user_id,db,True);answer=answer_question(m.segments,payload.question);db.add(MeetingQuestion(meeting_id=meeting_id,question=payload.question,answer=answer));db.commit();return {"answer":answer}
@app.get("/api/meetings/{meeting_id}/media")
def meeting_media(meeting_id:int,user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    m=get_meeting_or_404(meeting_id,user_id,db)
    if not m.media_path: raise HTTPException(404,"This meeting has no recording")
    path=UPLOAD_DIR/m.media_path
    if not path.exists(): raise HTTPException(404,"The recording file is missing")
    return FileResponse(path,media_type=m.media_type or "application/octet-stream")
@app.get("/api/meetings/{meeting_id}/export")
def export(meeting_id:int,format:str="markdown",user_id:str=Depends(current_user),db:Session=Depends(get_db)):
    m=get_meeting_or_404(meeting_id,user_id,db,True);lines=[f"# {m.title}",f"Date: {m.occurred_at.isoformat()}","", "## Summary",m.summary or "No summary yet.","", "## Action items"]
    lines += [f"- [{'x' if a.completed else ' '}] {a.text} ({a.owner})" for a in m.actions] or ["- None"]
    lines += ["", "## Transcript"] + [f"[{s.start_seconds//60:02d}:{s.start_seconds%60:02d}] {s.speaker}: {s.content}" for s in m.segments]
    text="\n".join(lines);media="text/markdown" if format=="markdown" else "text/plain";suffix="md" if format=="markdown" else "txt"
    return PlainTextResponse(text,media_type=media,headers={"Content-Disposition":f'attachment; filename="meeting-{m.id}.{suffix}"'})
