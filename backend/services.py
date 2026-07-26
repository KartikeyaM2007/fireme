import json
import os
import re
import subprocess
import tempfile
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

def normalize_speaker_labels(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Map Unknown / SPEAKER_00 style labels to Speaker 1, Speaker 2, … Keep real names."""
    mapping: dict[str, str] = {}
    next_n = 1
    for row in rows:
        raw = str(row.get("speaker") or "").strip() or "Unknown"
        low = raw.lower().replace("-", "_").replace(" ", "_")
        is_generic = low in {"unknown", "none", "null", "speaker"} or bool(
            re.match(r"^(speaker|spk)_?\d+$", low)
        )
        if is_generic:
            key = low if low not in {"unknown", "none", "null", "speaker"} else "__unknown__"
            if key not in mapping:
                mapping[key] = f"Speaker {next_n}"
                next_n += 1
            row["speaker"] = mapping[key]
        else:
            row["speaker"] = raw
    return rows


def repair_meeting_speakers(meeting: Any, db: Any) -> bool:
    """Persist Speaker N labels when segments are still Unknown (e.g. older Groq STT)."""
    segments = list(getattr(meeting, "segments", []) or [])
    if not segments:
        return False
    labeled = normalize_speaker_labels(
        [
            {
                "speaker": s.speaker,
                "start_seconds": s.start_seconds,
                "content": s.content,
            }
            for s in segments
        ]
    )
    changed = False
    for seg, lab in zip(segments, labeled):
        if seg.speaker != lab["speaker"]:
            seg.speaker = lab["speaker"]
            changed = True
    if changed:
        db.commit()
    return changed


def parse_transcript(raw: str, extension: str) -> list[dict[str, Any]]:
    if extension == ".json":
        payload = json.loads(raw)
        rows = payload.get("segments", payload) if isinstance(payload, dict) else payload
        if not isinstance(rows, list): raise HTTPException(422, "JSON transcript must be a list or have a segments list")
        parsed = [{"speaker": str(x.get("speaker", "Unknown")), "start_seconds": int(x.get("start_seconds", x.get("start", 0))), "content": str(x.get("content", x.get("text", ""))).strip()} for x in rows if str(x.get("content", x.get("text", ""))).strip()]
        return normalize_speaker_labels(parsed)
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
        return normalize_speaker_labels(output)
    output=[]
    for index, line in enumerate(raw.splitlines()):
        line=line.strip()
        if not line: continue
        match=re.match(r"(?:\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*)?(?:([^:]{1,40}):\s*)?(.*)", line)
        content=match.group(3).strip() if match else line
        if content: output.append({"speaker":(match.group(2) or "Unknown").strip(),"start_seconds":timestamp_to_seconds(match.group(1) or str(index*30)),"content":content})
    return normalize_speaker_labels(output)

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

GROQ_UPLOAD_LIMIT = 24 * 1024 * 1024
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".mpeg"}


def _ffmpeg_to_mp3(path: Path) -> Path:
    """Downsample to 16 kHz mono MP3 so Groq stays under the free-tier size cap."""
    fd, raw = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)
    out = Path(raw)
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        str(out),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0 or not out.exists() or out.stat().st_size == 0:
        out.unlink(missing_ok=True)
        detail = (proc.stderr or proc.stdout or "ffmpeg failed").strip().splitlines()[-1:]
        raise RuntimeError(detail[0] if detail else "ffmpeg failed to extract audio")
    return out


def prepare_transcription_file(path: Path) -> tuple[Path, bool]:
    """Return (file_to_upload, is_temp). Compress video/large files before Groq."""
    size = path.stat().st_size
    suffix = path.suffix.lower()
    if size <= GROQ_UPLOAD_LIMIT and suffix in AUDIO_EXTENSIONS:
        return path, False
    return _ffmpeg_to_mp3(path), True


def transcribe_media(path: Path) -> list[dict[str, Any]]:
    provider, client = require_ai()
    if provider == "groq":
        model = os.getenv("GROQ_TRANSCRIBE_MODEL", "whisper-large-v3-turbo")
        args = {"model": model, "response_format": "verbose_json"}
    else:
        model = os.getenv("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-transcribe-diarize")
        args = {"model": model, "response_format": "diarized_json"}
        if model == "gpt-4o-transcribe-diarize":
            args["chunking_strategy"] = "auto"
    upload_path, is_temp = prepare_transcription_file(path)
    try:
        if upload_path.stat().st_size > GROQ_UPLOAD_LIMIT:
            raise RuntimeError(
                f"Prepared audio is still {upload_path.stat().st_size // (1024 * 1024)} MB; "
                "split the recording or raise the provider size limit"
            )
        with upload_path.open("rb") as source:
            result = client.audio.transcriptions.create(file=source, **args)
    finally:
        if is_temp:
            upload_path.unlink(missing_ok=True)
    segments = getattr(result, "segments", None) or (result.get("segments", []) if isinstance(result, dict) else [])
    if segments:
        output = []
        for row in segments:
            data = row.model_dump() if hasattr(row, "model_dump") else row
            content = str(data.get("text", data.get("content", ""))).strip()
            if content:
                output.append(
                    {
                        "speaker": str(data.get("speaker", data.get("speaker_id", "Unknown"))),
                        "start_seconds": int(float(data.get("start", data.get("start_seconds", 0)))),
                        "content": content,
                    }
                )
        if output:
            return normalize_speaker_labels(output)
    text = getattr(result, "text", None) or (result.get("text", "") if isinstance(result, dict) else "")
    if text.strip():
        return normalize_speaker_labels(
            [{"speaker": "Unknown", "start_seconds": 0, "content": text.strip()}]
        )
    return []
