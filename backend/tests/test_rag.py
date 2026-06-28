"""Tests for the RAG service and its REST endpoints.

The architecture supports two RAG paths:

* **Python pipeline** (default — ``AI_PROVIDER=openrouter`` or ``azure_python``):
  the backend embeds the query, runs vector / FTS / RRF in Python, and calls
  an external LLM. The provider and the search service are mocked here so
  tests are hermetic.
* **Legacy Azure SQL SP path** (``AI_PROVIDER=azure``): the SP does the work.
  Still tested for backward compatibility, with the cursor mocked.

Every Python-pipeline test requests the two new fixtures:
``mock_ai_provider`` and ``mock_search_service``.
"""

from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.models import QueryLog, QueryStatus, QueryType
from app.services import rag_service, search_service


# ---------------------------------------------------------------------------
# Python pipeline (default mode) — uses mocked provider + search service
# ---------------------------------------------------------------------------
def test_find_similar_cases_uses_python_pipeline(
    monkeypatch, mock_ai_provider, mock_search_service
):
    """In ``openrouter`` mode, find_similar_cases must call provider.embed + search_service.vector_search."""
    embed_called_with: list[str] = []
    real_embed = mock_ai_provider.embed

    def _spy_embed(text: str):
        embed_called_with.append(text)
        return real_embed(text)

    monkeypatch.setattr(mock_ai_provider, "embed", _spy_embed)

    cases, latency = rag_service.find_similar_cases(
        "chest pain radiating to arm", 5, "FullCase"
    )
    assert len(cases) == 2
    assert cases[0].case_id == 17
    assert cases[0].similarity == pytest.approx(0.94)
    assert embed_called_with == ["chest pain radiating to arm"]
    assert isinstance(latency, int) and latency >= 0


def test_rrf_search_uses_python_pipeline(
    monkeypatch, mock_ai_provider, mock_search_service
):
    embed_called_with: list[str] = []
    real_embed = mock_ai_provider.embed

    def _spy(text: str):
        embed_called_with.append(text)
        return real_embed(text)

    monkeypatch.setattr(mock_ai_provider, "embed", _spy)

    cases, latency = rag_service.rrf_search(
        "Productive cough fever", "pneumonia", 5, "FullCase", 0.6, 0.4, 60
    )
    assert len(cases) == 2
    assert cases[0].case_id == 17
    assert embed_called_with == ["Productive cough fever"]
    assert isinstance(latency, int) and latency >= 0


def test_rag_search_returns_cases_and_llm_summary(
    monkeypatch, mock_ai_provider, mock_search_service
):
    cases, summary, latency = rag_service.rag_search(
        "Patient with chest pain", "MI", 5, "FullCase", 0.6, 0.4, 60
    )
    assert len(cases) == 2
    assert summary == "Mocked clinical summary."
    assert isinstance(latency, int) and latency >= 0


def test_rag_search_summary_failure_returns_friendly_message(
    monkeypatch, mock_ai_provider, mock_search_service
):
    """If the LLM call blows up we should still return the cases, plus a friendly note."""
    def _boom(*_a, **_kw) -> str:
        raise RuntimeError("upstream LLM unavailable")
    monkeypatch.setattr(mock_ai_provider, "chat", _boom)

    cases, summary, _ = rag_service.rag_search(
        "x" * 15, "y" * 5, 5, "FullCase", 0.6, 0.4, 60
    )
    assert len(cases) == 2
    assert "could not be reached" in summary
    assert "upstream LLM unavailable" in summary


def test_rag_search_with_no_retrieved_cases(
    monkeypatch, mock_ai_provider, mock_search_service
):
    """When the corpus returns nothing, the LLM should be told so explicitly."""
    monkeypatch.setattr(search_service, "hybrid_search", lambda *a, **kw: [])

    _cases, summary, _ = rag_service.rag_search(
        "patient description" * 2, "keyword" * 2, 5, "FullCase", 0.6, 0.4, 60
    )
    assert _cases == []
    assert "No similar clinical cases" in summary


# ---------------------------------------------------------------------------
# REST endpoint smoke tests (Python pipeline)
# ---------------------------------------------------------------------------
def test_rag_query_endpoint_logs_success(
    client: TestClient, auth_headers, mock_ai_provider, mock_search_service,
    db_session, admin_user,
):
    response = client.post(
        "/api/v1/rag/query",
        headers=auth_headers,
        json={
            "patient_description": "Patient presents with crushing substernal chest pain radiating to the left arm.",
            "keyword_search": "myocardial infarction",
            "top_n": 5,
            "embedding_type": "FullCase",
            "vector_weight": 0.6,
            "keyword_weight": 0.4,
            "rrf_k": 60,
        },
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert "cases" in data and len(data["cases"]) == 2
    assert data["clinical_summary"] == "Mocked clinical summary."
    assert data["latency_ms"] >= 0

    log = (
        db_session.query(QueryLog)
        .filter(QueryLog.user_id == admin_user.id, QueryLog.query_type == QueryType.rag)
        .first()
    )
    assert log is not None
    assert log.status == QueryStatus.success


def test_rag_query_endpoint_logs_error_on_provider_failure(
    client: TestClient, auth_headers, mock_search_service, db_session, admin_user, monkeypatch
):
    """A 502 is returned and the failure is recorded in the log table."""
    from app.services import provider_factory

    class _BoomProvider:
        name = "fake:boom"
        embed_dimensions = 1536
        def embed(self, _text): raise RuntimeError("simulated embed failure")
        def embed_batch(self, _texts): raise RuntimeError("simulated embed failure")
        def chat(self, *_a, **_kw): raise RuntimeError("simulated chat failure")

    provider_factory.get_ai_provider.cache_clear()
    monkeypatch.setattr(provider_factory, "get_ai_provider", lambda: _BoomProvider())

    try:
        response = client.post(
            "/api/v1/rag/query",
            headers=auth_headers,
            json={
                "patient_description": "Patient with severe shortness of breath and tachycardia.",
                "keyword_search": "pulmonary embolism",
                "top_n": 3,
                "embedding_type": "FullCase",
            },
        )
        assert response.status_code == 502

        err_log = (
            db_session.query(QueryLog)
            .filter(QueryLog.user_id == admin_user.id, QueryLog.status == QueryStatus.error)
            .first()
        )
        assert err_log is not None
        assert "simulated" in (err_log.error_message or "")
    finally:
        # monkeypatch automatically restores the original — no manual cleanup needed.
        pass


def test_vector_search_endpoint(
    client: TestClient, auth_headers, mock_ai_provider, mock_search_service
):
    response = client.post(
        "/api/v1/rag/search/vector",
        headers=auth_headers,
        json={
            "case_text": "Severe headache with photophobia",
            "top_k": 3,
            "embedding_type": "FullCase",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["cases"]) == 2
    assert data["latency_ms"] >= 0


def test_hybrid_search_endpoint(
    client: TestClient, auth_headers, mock_ai_provider, mock_search_service
):
    response = client.post(
        "/api/v1/rag/search/hybrid",
        headers=auth_headers,
        json={
            "query_text": "Productive cough with fever for 5 days",
            "keyword_search": "pneumonia fever",
            "top_n": 5,
            "embedding_type": "FullCase",
            "vector_weight": 0.6,
            "keyword_weight": 0.4,
            "rrf_k": 60,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["cases"]) == 2
    assert data["latency_ms"] >= 0


def test_rag_config_get_returns_defaults(client: TestClient, auth_headers):
    response = client.get("/api/v1/rag/config", headers=auth_headers)
    assert response.status_code == 200
    keys = {c["key"] for c in response.json()}
    assert {"top_n", "embedding_type", "vector_weight", "keyword_weight", "rrf_k"} <= keys


# ---------------------------------------------------------------------------
# Legacy Azure SQL SP path — covered with a pyodbc cursor mock
# ---------------------------------------------------------------------------
def _make_mock_cursor_with_cases() -> Any:
    """Build a mock connection mimicking pyodbc: cases result set + optional summary.

    The cursor's rows expose column access via attribute names (``row.CaseID``)
    because that's the contract ``_row_to_similar_case`` relies on for the
    SP path. Named tuples are the simplest way to do that.
    """
    from collections import namedtuple

    CaseRow = namedtuple(
        "CaseRow",
        [
            "CaseID", "PatientAge", "Gender", "ChiefComplaint", "Symptoms",
            "MedicalHistory", "Diagnosis", "Severity", "TreatmentPlan", "Outcome",
            "Similarity", "VectorDistance", "KeywordScore", "HybridScore",
        ],
    )
    case_rows = [
        CaseRow(17, 58, "M", "Crushing chest pain", "Pain radiating to left arm",
                "Smoker", "Acute MI", "High", "Aspirin + cath lab", "Recovered",
                0.94, 0.06, None, None),
        CaseRow(24, 65, "F", "Severe headache", "Thunderclap onset, photophobia",
                "HTN", "Subarachnoid hemorrhage", "Critical", "CT angio + neurosurgery consult",
                "ICU admit", 0.81, 0.19, None, None),
    ]

    class _Cursor:
        description = [(name, None, None, None, None, None, None)
                       for name in CaseRow._fields]

        def __init__(self):
            self._index = 0
            self._cases = case_rows

        # context manager support — rag_service uses ``with conn.cursor() as cur``
        def __enter__(self):
            return self

        def __exit__(self, *_exc):
            return False

        def execute(self, _stmt, _params=None):
            self._index = 0
            return self

        def fetchall(self):
            return list(self._cases)

        def fetchone(self):
            if self._index == 0:
                self._index = 1
                return ("Mocked clinical summary (SP path).",)
            return None

        def nextset(self):
            return True

    class _Conn:
        # context manager support — rag_service uses ``with get_azure_sql_connection() as conn``
        def __enter__(self):
            return self

        def __exit__(self, *_exc):
            return False

        def cursor(self):
            return _Cursor()

        def close(self):
            pass

    return _Conn()


def test_legacy_azure_sp_path_dispatcher(monkeypatch):
    """When AI_PROVIDER=azure, the dispatcher calls the SP and parses its rows."""
    monkeypatch.setattr(settings, "ai_provider", "azure", raising=False)
    conn = _make_mock_cursor_with_cases()
    monkeypatch.setattr(rag_service, "get_azure_sql_connection", lambda: conn)

    cases, latency = rag_service.find_similar_cases("chest pain", 5, "FullCase")
    assert len(cases) == 2
    assert cases[0].case_id == 17
    assert cases[0].similarity == pytest.approx(0.94)

    cases, summary, latency = rag_service.rag_search(
        "patient with chest pain", "MI", 5, "FullCase", 0.6, 0.4, 60
    )
    assert len(cases) == 2
    assert summary == "Mocked clinical summary (SP path)."
    assert isinstance(latency, int) and latency >= 0
