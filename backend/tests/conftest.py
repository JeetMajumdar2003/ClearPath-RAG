"""Pytest configuration: ensure backend root is importable and override settings for tests."""

import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Force-test settings BEFORE app modules are imported anywhere.
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("SQL_SERVER", "")  # no Azure SQL in tests
os.environ.setdefault("SQL_USERNAME", "")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("ADMIN_EMAIL", "admin@test.local")
os.environ.setdefault("ADMIN_PASSWORD", "AdminPass1!")


# ---------------------------------------------------------------------------
# Patch the Enum columns on the SQLAlchemy models so they can be created in
# SQLite. Postgres' native ENUM type isn't supported by SQLite, so we swap
# each Enum column to a plain String column for the duration of the test
# session. The production schema (Postgres) is unchanged.
# ---------------------------------------------------------------------------
from sqlalchemy import String
import app.models as _models  # noqa: E402

_ENUM_FIELDS = {
    "User": ["role"],
    "QueryLog": ["query_type", "status"],
}

for _cls_name, _fields in _ENUM_FIELDS.items():
    _cls = getattr(_models, _cls_name, None)
    if _cls is None:
        continue
    _table = _cls.__table__
    for _col_name in _fields:
        _col = _table.columns.get(_col_name)
        if _col is None:
            continue
        _new_col = String(50, name=_col_name, nullable=_col.nullable)
        _table.columns._data.pop(_col_name, None)
        _table.append_column(_new_col)


# ---------------------------------------------------------------------------
# Now safely import the rest of the test fixtures.
# ---------------------------------------------------------------------------
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
from app.main import app
from app.models import User, UserRole
from app.services.auth_service import create_user
from app.core.security import create_access_token


@pytest.fixture(scope="function")
def db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture(scope="function")
def db_session(db_engine) -> Generator:
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_engine, monkeypatch) -> Generator[TestClient, None, None]:
    """FastAPI TestClient with the metadata DB swapped to in-memory SQLite."""

    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)

    def _override_get_db():
        s = TestingSessionLocal()
        try:
            yield s
        finally:
            s.close()

    from app.db import session as session_mod

    monkeypatch.setattr(session_mod, "SessionLocal", TestingSessionLocal)
    app.dependency_overrides[session_mod.get_db] = _override_get_db

    # Patch Azure SQL interactions at the *source* module to keep tests hermetic.
    from app.db import azure_sql as azure_sql_mod
    from app.services import analytics_service, rag_service

    monkeypatch.setattr(azure_sql_mod, "check_azure_sql_connection", lambda: False)
    monkeypatch.setattr(rag_service, "get_clinical_case_count", lambda: 100)
    monkeypatch.setattr(
        analytics_service, "check_azure_sql_connection", lambda: False
    )

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def admin_user(db_session) -> User:
    return create_user(db_session, "admin@test.local", "AdminPass1!", "Admin", UserRole.admin)


@pytest.fixture
def clinician_user(db_session) -> User:
    return create_user(db_session, "doc@test.local", "DocPass123!", "Dr. Test", UserRole.clinician)


@pytest.fixture
def admin_token(admin_user) -> str:
    return create_access_token(admin_user.email, extra={"role": admin_user.role.value})


@pytest.fixture
def clinician_token(clinician_user) -> str:
    return create_access_token(clinician_user.email, extra={"role": clinician_user.role.value})


@pytest.fixture
def auth_headers(admin_token) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}
