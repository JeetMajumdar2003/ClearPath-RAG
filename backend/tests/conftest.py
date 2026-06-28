"""Pytest configuration: ensure backend root is importable and override settings for tests.

In addition to setting up the in-memory metadata database, this conftest
also patches the AI provider factory and the search service so RAG tests
run hermetically without OpenRouter or a real SQL Server.
"""

import os
import sys
from pathlib import Path
from typing import List

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Force-test settings BEFORE app modules are imported anywhere.
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("SQL_SERVER", "")  # no clinical SQL Server in tests
os.environ.setdefault("SQL_USERNAME", "")
os.environ.setdefault("POSTGRES_HOST", "localhost")
os.environ.setdefault("ADMIN_EMAIL", "admin@test.local")
os.environ.setdefault("ADMIN_PASSWORD", "AdminPass1!")
# Default to the Python pipeline in tests — the SP path is covered by a
# dedicated ``test_legacy_azure_sp_path`` test that overrides this.
os.environ.setdefault("AI_PROVIDER", "openrouter")
os.environ.setdefault("OPENROUTER_API_KEY", "test-openrouter-key")


# ---------------------------------------------------------------------------
# Wrap Postgres-only ENUM types with a TypeDecorator that stores as VARCHAR
# on SQLite (which has no native ENUM) but still hands back the Python enum
# on read. Production Postgres keeps its native ENUM type untouched.
# ---------------------------------------------------------------------------
from sqlalchemy import event, String, TypeDecorator  # noqa: E402
from sqlalchemy.types import Enum as SAEnum  # noqa: E402
import app.models as _models  # noqa: E402
import app.db.base as _base  # noqa: E402


class _EnumAsString(TypeDecorator):
    """Stores Enum values as VARCHAR; returns the Enum instance on read.

    Lets the production models keep declaring ``Enum(UserRole)`` (a true
    Postgres ENUM on Postgres) while making the same model usable on SQLite
    in tests without changing any application code.
    """

    impl = String
    cache_ok = True

    def __init__(self, enum_cls, *args, **kwargs):
        self._enum_cls = enum_cls
        super().__init__(length=50, *args, **kwargs)

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return getattr(value, "value", value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        try:
            return self._enum_cls(value)
        except (ValueError, KeyError):
            return value


# Replace every Enum(...) column on the model metadata with _EnumAsString so
# SQLite can create the table. The application code is unchanged.
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
        if _col is None or not isinstance(_col.type, SAEnum):
            continue
        _enum_cls = _col.type.enum_class
        _new_type = _EnumAsString(_enum_cls)
        _col.type = _new_type


# Belt-and-braces: even if some new model slips through, fall back to VARCHAR
# on SQLite at create time.
@event.listens_for(_base.Base.metadata, "before_create")
def _sqlite_enum_to_varchar(target, connection, **kw):  # noqa: D401
    if connection.dialect.name == "sqlite":
        for table in target.tables.values():
            for col in list(table.columns):
                col_type = col.type
                if isinstance(col_type, SAEnum) and not isinstance(col_type, TypeDecorator):
                    col.type = String(50)



# ---------------------------------------------------------------------------
# Now safely import the rest of the test fixtures.
# ---------------------------------------------------------------------------
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User, UserRole  # noqa: E402
from app.services.ai_provider import AIProvider  # noqa: E402
from app.services.auth_service import create_user  # noqa: E402
from app.core.security import create_access_token  # noqa: E402


# ---------------------------------------------------------------------------
# Fake AI provider — used by every RAG test in the Python pipeline path
# ---------------------------------------------------------------------------
class _FakeProvider(AIProvider):
    """Deterministic AIProvider for tests — no network calls."""

    name = "fake:fake-chat-model"
    embed_dimensions = 1536

    def embed(self, text: str) -> List[float]:
        # Deterministic: a unit-ish vector that varies with the text.
        # The shape (0..1) doesn't matter for tests — we just need *some* vector
        # of the declared length.
        seed = sum(ord(c) for c in text) or 1
        return [((seed + i) % 1000) / 1000.0 for i in range(self.embed_dimensions)]

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.embed(t) for t in texts]

    def chat(self, system: str, user: str, *, temperature: float = 0.2, max_tokens: int = 800) -> str:
        return "Mocked clinical summary."


# ---------------------------------------------------------------------------
# Synthetic case rows — used by every RAG test in the Python pipeline path
# ---------------------------------------------------------------------------
_FAKE_CASES = [
    {
        "CaseID": 17, "PatientAge": 58, "Gender": "M",
        "ChiefComplaint": "Crushing chest pain", "Symptoms": "Pain radiating to the left arm",
        "MedicalHistory": "Smoker", "Diagnosis": "Acute MI", "Severity": "High",
        "TreatmentPlan": "Aspirin + cath lab", "Outcome": "Recovered",
        "Similarity": 0.94, "VectorDistance": 0.06,
        "KeywordScore": 0.8, "HybridScore": 0.88,
    },
    {
        "CaseID": 24, "PatientAge": 65, "Gender": "F",
        "ChiefComplaint": "Severe headache", "Symptoms": "Thunderclap onset, photophobia",
        "MedicalHistory": "HTN", "Diagnosis": "Subarachnoid hemorrhage", "Severity": "Critical",
        "TreatmentPlan": "CT angio + neurosurgery consult", "Outcome": "ICU admit",
        "Similarity": 0.81, "VectorDistance": 0.19,
        "KeywordScore": 0.5, "HybridScore": 0.71,
    },
]


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
def db_session(db_engine):
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def fake_provider():
    """An instance of the deterministic fake AIProvider."""
    return _FakeProvider()


@pytest.fixture
def mock_ai_provider(monkeypatch, fake_provider):
    """Patch ``provider_factory.get_ai_provider`` to return a deterministic fake.

    Also clears the ``lru_cache`` so the patched version is actually used.
    ``monkeypatch.setattr`` automatically restores the original at teardown,
    so we don't need any manual cleanup.
    """
    from app.services import provider_factory

    provider_factory.get_ai_provider.cache_clear()
    monkeypatch.setattr(provider_factory, "get_ai_provider", lambda: fake_provider)
    yield fake_provider


@pytest.fixture
def mock_search_service(monkeypatch):
    """Patch every search_service function the Python pipeline depends on."""
    from app.services import search_service

    monkeypatch.setattr(search_service, "vector_search", lambda *a, **kw: list(_FAKE_CASES))
    monkeypatch.setattr(search_service, "keyword_search", lambda *a, **kw: list(_FAKE_CASES))
    monkeypatch.setattr(search_service, "hybrid_search", lambda *a, **kw: list(_FAKE_CASES))
    monkeypatch.setattr(search_service, "get_clinical_case_count", lambda: 100)
    return list(_FAKE_CASES)


@pytest.fixture(scope="function")
def client(db_engine, monkeypatch) -> TestClient:
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

    # Patch clinical-SQL interactions at the *source* module to keep tests hermetic.
    from app.db import azure_sql as azure_sql_mod
    from app.services import analytics_service, rag_service, search_service

    monkeypatch.setattr(azure_sql_mod, "check_azure_sql_connection", lambda: False)
    monkeypatch.setattr(rag_service, "get_clinical_case_count", lambda: 100)
    monkeypatch.setattr(search_service, "get_clinical_case_count", lambda: 100)
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
    # ``role`` may be a String column (SQLite in tests) or a UserRole enum
    # (Postgres in production). Handle both shapes.
    role_value = getattr(admin_user.role, "value", admin_user.role)
    return create_access_token(admin_user.email, extra={"role": role_value})


@pytest.fixture
def clinician_token(clinician_user) -> str:
    role_value = getattr(clinician_user.role, "value", clinician_user.role)
    return create_access_token(clinician_user.email, extra={"role": role_value})


@pytest.fixture
def auth_headers(admin_token) -> dict[str, str]:
    return {"Authorization": f"Bearer {admin_token}"}
