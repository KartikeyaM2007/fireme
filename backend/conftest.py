import os
import tempfile
from pathlib import Path


TEST_DATABASE = Path(tempfile.gettempdir()) / f"fireme-pytest-{os.getpid()}.db"
TEST_DATABASE.unlink(missing_ok=True)
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DATABASE.as_posix()}"


def pytest_sessionfinish(session, exitstatus) -> None:
    from database import engine

    engine.dispose()
    TEST_DATABASE.unlink(missing_ok=True)
