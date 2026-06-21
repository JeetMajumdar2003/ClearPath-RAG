"""Tests for the RAG service / endpoints with Azure SQL calls mocked."""

from fastapi.testclient import TestClient

from app.models import QueryLog, QueryStatus, QueryType, RagConfig
from app.services import rag_service


def _make_cursor_with_cases(cases):
    """Build a mock cursor mimicking pyodbc: cases result set + optional summary."""

    class _Cursor:
        def __init__(self):
            self._cases = cases
            self._summary_row = ("Mocked clinical summary.",)
            self._index = 0

        @property
        def description(self):
            return [
                ("CaseID", None, None, None, None, None, None),
                ("PatientAge", None, None, None, None, None, None),
                ("Gender", None, None, None, None, None, None),
                ("ChiefComplaint", None, None, None, None, None, None),
                ("Diagnosis", None, None, None, None, None, None),
                ("Severity", None, None, None, None, None, None),
                ("TreatmentPlan", None, None, None, None, None, None),
                ("Similarity", None, None, None, None, None, None),
                ("VectorDistance", None, None, None, None, None, None),
                ("KeywordScore", None, None, None, None, None, None),
                ("HybridScore", None, None, None, None, None, None),
            ]

        def execute(self, _stmt, _params=None):
            self._index = 0
            return self

        def fetchall(self):
            return [
                (
                    17, 58, "M", "Crushing chest pain", "Acute MI", "High",
                    "Aspirin + cath lab", 0.94, 0.06, None, None,
                ),
                (
                    24, 65, "F", "Severe headache", "Subarachnoid hemorrhage", "Critical",
                    "CT angio + neurosurgery consult", 0.81, 0.19, None, None,
                ),
            ]

        def fetchone(self):
            if self._index == 0:
                self._index = 1
                return self._summary_row
            return None

        def nextset(self):
            return False

    class _Conn:
        def cursor(self):
            return _Cursor()

        def close(self):
            pass

    return _Conn


def test_find_similar_cases_returns_parsed_results(monkeypatch):
    conn = _make_cursor_with_cases(None)
    monkeypatch.setattr(rag_service, "get_azure_sql_connection", lambda: conn)
    cases, latency = rag_service.find_similar_cases("chest pain", 5, "FullCase")
    assert len(cases) == 2
    assert cases[0].case_id == 17
    assert cases[0].similarity == 0.94
    assert isinstance(latency, int) and latency >= 0


def test_rag_search_returns_cases_and_summary(monkeypatch):
    conn = _make_cursor_with_cases(None)
    monkeypatch.setattr(rag_service, "get_azure_sql_connection", lambda: conn)
    cases, summary, latency = rag_service.rag_search(
        "Patient with chest pain", "MI", 5, "FullCase", 0.6, 0.4, 60
    )
    assert len(cases) == 2
    assert summary == "Mocked clinical summary."
    assert latency >= 0


def test_rag_query_endpoint_logs_success(client: TestClient, auth_headers, monkeypatch, db_session, admin_user):
    conn = _make_cursor_with_cases(None)
    monkeypatch.setattr(rag_service, "get_azure_sql_connection", lambda: conn)

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
    assert "cases" in data
    assert data["clinical_summary"] == "Mocked clinical summary."
    assert data["latency_ms"] >= 0

    # Verify a log row was written for the current admin.
    log = (
        db_session.query(QueryLog)
        .filter(QueryLog.user_id == admin_user.id, QueryLog.query_type == QueryType.rag)
        .first()
    )
    assert log is not None
    assert log.status == QueryStatus.success


def test_rag_query_endpoint_logs_error_on_sp_failure(client: TestClient, auth_headers, monkeypatch, db_session, admin_user):
    class _BoomCursor:
        description = None
        def execute(self, *_a, **_kw):
            raise RuntimeError("simulated SP failure")

    class _BoomConn:
        def cursor(self):
            return _BoomCursor()
        def close(self):
            pass

    monkeypatch.setattr(rag_service, "get_azure_sql_connection", lambda: _BoomConn())

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
    # Logged as error.
    err_log = (
        db_session.query(QueryLog)
        .filter(QueryLog.user_id == admin_user.id, QueryLog.status == QueryStatus.error)
        .first()
    )
    assert err_log is not None
    assert "simulated SP failure" in (err_log.error_message or "")


def test_vector_search_endpoint(client: TestClient, auth_headers, monkeypatch):
    conn = _make_cursor_with_cases(None)
    monkeypatch.setattr(rag_service, "get_azure_sql_connection", lambda: conn)

    response = client.post(
        "/api/v1/rag/search/vector",
        headers=auth_headers,
        json={"case_text": "Severe headache with photophobia", "top_k": 3, "embedding_type": "FullCase"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["cases"]) == 2
    assert data["latency_ms"] >= 0


def test_hybrid_search_endpoint(client: TestClient, auth_headers, monkeypatch):
    conn = _make_cursor_with_cases(None)
    monkeypatch.setattr(rag_service, "get_azure_sql_connection", lambda: conn)

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


def test_rag_config_get_returns_defaults(client: TestClient, auth_headers):
    response = client.get("/api/v1/rag/config", headers=auth_headers)
    assert response.status_code == 200
    keys = {c["key"] for c in response.json()}
    assert {"top_n", "embedding_type", "vector_weight", "keyword_weight", "rrf_k"} <= keys


def test_rag_config_put_requires_admin(client: TestClient, clinician_token):
    response = client.put(
        "/api/v1/rag/config",
        headers={"Authorization": f"Bearer {clinician_token}"},
        json={"top_n": 8},
    )
    assert response.status_code == 403


def test_rag_config_put_updates_values(client: TestClient, auth_headers, db_session):
    response = client.put(
        "/api/v1/rag/config",
        headers=auth_headers,
        json={"top_n": 8, "vector_weight": 0.7, "keyword_weight": 0.3},
    )
    assert response.status_code == 200
    payload = {c["key"]: c["value"] for c in response.json()}
    assert payload["top_n"] == "8"
    assert payload["vector_weight"] == "0.7"

    # Persisted to DB.
    row = db_session.query(RagConfig).filter(RagConfig.key == "top_n").first()
    assert row is not None
    assert row.value == "8"