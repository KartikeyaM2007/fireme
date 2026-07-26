import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv(Path(__file__).with_name(".env"))
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fireme.db")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema() -> None:
    """Add columns introduced after initial create_all without a full migration tool."""
    insp = inspect(engine)
    if "meetings" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("meetings")}
    if "processing_error" in cols:
        return
    dialect = engine.dialect.name
    stmt = (
        "ALTER TABLE meetings ADD COLUMN processing_error TEXT"
        if dialect == "sqlite"
        else "ALTER TABLE meetings ADD COLUMN IF NOT EXISTS processing_error TEXT"
    )
    with engine.begin() as conn:
        conn.execute(text(stmt))
