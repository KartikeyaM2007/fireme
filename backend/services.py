import json
import os
import re
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from pydantic import BaseModel, Field, ValidationError

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

TEXT_EXTENSIONS = {".txt", ".vtt", ".srt", ".json"}
MEDIA_EXTENSIONS = {".mp3", ".mp4", ".m4a", ".wav", ".webm", ".ogg", ".mpeg", ".flac"}

class InsightChapter(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    start_seconds: int = Field(ge=0)
    summary: str = Field(min_length=1, max_length=1000)

class InsightAction(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    owner: str = Field(default="Unassigned", max_length=100)

class InsightPayload(BaseModel):
    summary: str = Field(min_length=1, max_length=5000)
    topics: list[str] = Field(min_length=1, max_length=8)
    chapters: list[InsightChapter] = Field(min_length=1, max_length=10)
    actions: list[InsightAction] = Field(max_length=20)

def timestamp_to_seconds(value: str) -> int:
    parts = value.strip().replace(",", ".").split(":")
    try:
        return int(float(parts[-1])) + (int(parts[-2]) * 60 if len(parts) > 1 else 0) + (int(parts[-3]) * 3600 if len(parts) > 2 else 0)
    except ValueError:
        return 0

def parse_transcript(raw: str, extension: str) -> list[dict[str, Any]]:
    if extension == ".json":
        payload = json.loads(raw)
        rows = payload.get("segments", payload) if isinstance(payload, dict) else payload
        if not isinstance(rows, list): raise HTTPException(422, "JSON transcript must be a list or have a segments list")
        return [{"speaker": str(x.get("speaker", "Unknown")), "start_seconds": int(x.get("start_seconds", x.get("start", 0))), "content": str(x.get("content", x.get("text", ""))).strip()} for x in rows if str(x.get("content", x.get("text", ""))).strip()]
    if extension in {".vtt", ".srt"}:
        blocks = re.split(r"\n\s*\n", raw.replace("\r", ""))
        output=[]
        for block in blocks:
            lines=[x.strip() for x in block.split("\n") if x.strip() and x.strip() != "WEBVTT"]
            time_line=next((x for x in lines if "-->" in x), None)
            if not time_line: continue
            text=" ".join(x for x in lines if x != time_line and not x.isdigit())
            speaker="Unknown"
            match=re.match(r"(?:<v\s+([^>]+)>|([^:]{1,40}):)\s*(.*)", text)
            if match: speaker=(match.group(1) or match.group(2) or "Unknown").strip(); text=match.group(3)
            if text: output.append({"speaker":speaker,"start_seconds":timestamp_to_seconds(time_line.split("-->")[0]),"content":re.sub(r"<[^>]+>","",text).strip()})
        return output
    output=[]
    for index, line in enumerate(raw.splitlines()):
        line=line.strip()
        if not line: continue
        match=re.match(r"(?:\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*)?(?:([^:]{1,40}):\s*)?(.*)", line)
        content=match.group(3).strip() if match else line
        if content: output.append({"speaker":(match.group(2) or "Unknown").strip(),"start_seconds":timestamp_to_seconds(match.group(1) or str(index*30)),"content":content})
    return output

def transcript_text(segments: list[Any]) -> str:
    return "\n".join(f"[{s.start_seconds//60:02d}:{s.start_seconds%60:02d}] {s.speaker}: {s.content}" for s in segments)

def require_ai() -> tuple[str, Any]:
    """Return the configured OpenAI-compatible AI client without exposing keys to callers."""
    provider=os.getenv("AI_PROVIDER", "groq" if os.getenv("GROQ_API_KEY") else "openai").lower()
    from openai import OpenAI
    if provider == "groq":
        key=os.getenv("GROQ_API_KEY")
        if not key: raise HTTPException(503, "GROQ_API_KEY is not configured. Add it to backend/.env, then retry processing.")
        return provider, OpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")
    if provider == "openai":
        key=os.getenv("OPENAI_API_KEY")
        if not key: raise HTTPException(503, "OPENAI_API_KEY is not configured. Add it to backend/.env, then retry processing.")
        return provider, OpenAI(api_key=key)
    raise HTTPException(503, "AI_PROVIDER must be 'groq' or 'openai'")

def chat_completion(client: Any, model: str, prompt: str) -> str:
    response=client.chat.completions.create(
        model=model,
        messages=[{"role":"user","content":prompt}],
        temperature=0.2,
    )
    return (response.choices[0].message.content or "").strip()

def json_from_model(client: Any, provider: str, prompt: str) -> dict[str, Any]:
    model=os.getenv("GROQ_SUMMARY_MODEL", "llama-3.3-70b-versatile") if provider == "groq" else os.getenv("OPENAI_SUMMARY_MODEL", "gpt-5-mini")
    body=chat_completion(client, model, prompt)
    match=re.search(r"\{.*\}", body, re.S)
    if not match: raise HTTPException(502, "The AI service did not return valid structured data")
    try:
        return InsightPayload.model_validate_json(match.group(0)).model_dump()
    except ValidationError as exc:
        raise HTTPException(502, "The AI service returned an invalid insight shape") from exc

def generate_insights(segments: list[Any]) -> dict[str, Any]:
    provider,client=require_ai()
    content=transcript_text(segments)
    if not content.strip(): raise HTTPException(422, "Add a transcript before generating AI insights")
    prompt=f'''You are a precise meeting analyst. Read the transcript and return ONLY valid JSON with this exact shape:
{{"summary":"2-4 concise sentences","topics":["topic"],"chapters":[{{"title":"string","start_seconds":0,"summary":"string"}}],"actions":[{{"text":"imperative task","owner":"person or Unassigned"}}]}}
Do not invent facts. Include 2-6 topics, 2-8 chapters and only explicit or strongly implied action items.
TRANSCRIPT:\n{content}'''
    return json_from_model(client,provider,prompt)

def answer_question(segments: list[Any], question: str) -> str:
    provider,client=require_ai()
    prompt=f'''Answer the question using only this meeting transcript. If the answer is absent, say so clearly. Cite relevant timestamps in [MM:SS] form.\n\nTRANSCRIPT:\n{transcript_text(segments)}\n\nQUESTION: {question}'''
    model=os.getenv("GROQ_SUMMARY_MODEL", "llama-3.3-70b-versatile") if provider == "groq" else os.getenv("OPENAI_SUMMARY_MODEL", "gpt-5-mini")
    return chat_completion(client, model, prompt)

def transcribe_media(path: Path) -> list[dict[str, Any]]:
    provider,client=require_ai()
    if provider == "groq":
        model=os.getenv("GROQ_TRANSCRIBE_MODEL", "whisper-large-v3-turbo")
        args={"model":model,"response_format":"verbose_json"}
    else:
        model=os.getenv("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-transcribe-diarize")
        args={"model":model,"response_format":"diarized_json"}
        if model == "gpt-4o-transcribe-diarize": args["chunking_strategy"]="auto"
    with path.open("rb") as source:
        result=client.audio.transcriptions.create(file=source, **args)
    segments=getattr(result,"segments",None) or (result.get("segments",[]) if isinstance(result,dict) else [])
    if segments:
        output=[]
        for row in segments:
            data=row.model_dump() if hasattr(row,"model_dump") else row
            content=str(data.get("text",data.get("content",""))).strip()
            if content: output.append({"speaker":str(data.get("speaker",data.get("speaker_id","Unknown"))),"start_seconds":int(float(data.get("start",data.get("start_seconds",0)))),"content":content})
        if output:return output
    text=getattr(result,"text",None) or (result.get("text","") if isinstance(result,dict) else "")
    return [{"speaker":"Unknown","start_seconds":0,"content":text.strip()}] if text.strip() else []
