"""Upload persistence: local disk mirror + durable Postgres blobs (and optional Supabase Storage)."""
from __future__ import annotations

import os
from pathlib import Path

import httpx
from sqlalchemy.orm import Session

from models import MediaBlob
from services import UPLOAD_DIR

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or ""
SUPABASE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "meeting-uploads")


def storage_backend() -> str:
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        return "supabase"
    return "postgres"


def save_bytes(db: Session, key: str, raw: bytes, content_type: str | None) -> str:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    path = UPLOAD_DIR / key
    path.write_bytes(raw)

    if storage_backend() == "supabase":
        url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{key}"
        headers = {
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": content_type or "application/octet-stream",
            "x-upsert": "true",
        }
        response = httpx.put(url, content=raw, headers=headers, timeout=120.0)
        if response.status_code >= 400:
            raise RuntimeError(f"Supabase storage upload failed: {response.status_code} {response.text[:200]}")
        return f"supabase:{key}"

    existing = db.get(MediaBlob, key)
    if existing:
        existing.data = raw
        existing.content_type = content_type
    else:
        db.add(MediaBlob(key=key, data=raw, content_type=content_type))
    db.commit()
    return f"postgres:{key}"


def resolve_local_path(media_path: str, db: Session) -> Path:
    """Ensure a local file exists for transcription / FileResponse (hydrate from durable store if needed)."""
    key = media_path.split(":", 1)[-1] if ":" in media_path else media_path
    path = UPLOAD_DIR / key
    if path.exists():
        return path

    if media_path.startswith("supabase:") or (storage_backend() == "supabase" and not path.exists()):
        url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{key}"
        headers = {
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
        }
        response = httpx.get(url, headers=headers, timeout=120.0)
        if response.status_code >= 400:
            raise FileNotFoundError(key)
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        path.write_bytes(response.content)
        return path

    blob = db.get(MediaBlob, key)
    if not blob:
        raise FileNotFoundError(key)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    path.write_bytes(blob.data)
    return path


def delete_media(db: Session, media_path: str | None) -> None:
    if not media_path:
        return
    key = media_path.split(":", 1)[-1] if ":" in media_path else media_path
    (UPLOAD_DIR / key).unlink(missing_ok=True)
    blob = db.get(MediaBlob, key)
    if blob:
        db.delete(blob)
        db.commit()
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{key}"
        headers = {
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
        }
        try:
            httpx.delete(url, headers=headers, timeout=30.0)
        except Exception:
            pass
