"""Tests for dashboard / logs / analytics endpoints."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.models import QueryLog, QueryStatus, QueryType


def _seed_logs(db_session, admin_user):
    base = datetime.now(timezone.utc) - timedelta(days=2)
    db_session.add_all([
        QueryLog(
            user_id=admin_user.id,
            query_type=QueryType.rag,
            patient_description="chest pain",
            keyword_search="MI",
            top_n=5,
            embedding_type="FullCase",
            latency_ms=500,
            status=QueryStatus.success,
            created_at=base,
        ),
        QueryLog(
            user_id=admin_user.id,
            query_type=QueryType.vector,
            patient_description="headache",
            top_n=5,
            embedding_type="FullCase",
            latency_ms=120,
            status=QueryStatus.success,
            created_at=base + timedelta(hours=1),
        ),
        QueryLog(
            user_id=admin_user.id,
            query_type=QueryType.hybrid,
            patient_description="fever cough",
            keyword_search="pneumonia",
            top_n=10,
            embedding_type="FullCase",
            latency_ms=900,
            status=QueryStatus.error,
            error_message="timeout",
            created_at=base + timedelta(hours=2),
        ),
    ])
    db_session.commit()


def test_dashboard_overview(client: TestClient, auth_headers, admin_user, db_session):
    _seed_logs(db_session, admin_user)
    response = client.get("/api/v1/dashboard/overview", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total_queries"] == 3
    assert data["queries_today"] >= 0
    assert 0.0 <= data["success_rate"] <= 100.0
    assert data["clinical_case_count"] == 100


def test_logs_pagination_and_filters(client: TestClient, auth_headers, admin_user, db_session):
    _seed_logs(db_session, admin_user)

    # All logs
    response = client.get("/api/v1/logs", headers=auth_headers, params={"page": 1, "page_size": 10})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert len(body["items"]) == 3

    # Filter by status=error
    response = client.get(
        "/api/v1/logs",
        headers=auth_headers,
        params={"page": 1, "page_size": 10, "status": "error"},
    )
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["status"] == "error"
    assert body["items"][0]["error_message"] == "timeout"

    # Filter by query_type=vector
    response = client.get(
        "/api/v1/logs",
        headers=auth_headers,
        params={"page": 1, "page_size": 10, "query_type": "vector"},
    )
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["query_type"] == "vector"


def test_logs_user_email_joined(client: TestClient, auth_headers, admin_user, db_session):
    _seed_logs(db_session, admin_user)
    response = client.get("/api/v1/logs", headers=auth_headers)
    for item in response.json()["items"]:
        assert item["user_email"] == admin_user.email


def test_analytics_usage_returns_daily_and_by_type(
    client: TestClient, auth_headers, admin_user, db_session
):
    _seed_logs(db_session, admin_user)
    response = client.get("/api/v1/analytics/usage", headers=auth_headers, params={"days": 30})
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["daily"], list)
    assert any(d["count"] >= 1 for d in body["daily"])
    type_counts = {entry["query_type"]: entry["count"] for entry in body["by_type"]}
    assert type_counts == {"rag": 1, "vector": 1, "hybrid": 1}


def test_analytics_performance_percentiles(
    client: TestClient, auth_headers, admin_user, db_session
):
    _seed_logs(db_session, admin_user)
    response = client.get("/api/v1/analytics/performance", headers=auth_headers, params={"days": 30})
    assert response.status_code == 200
    body = response.json()
    # Only success rows have latency -> 2
    assert body["success_count"] == 2
    assert body["error_count"] == 1
    assert body["avg_latency_ms"] == pytest.approx((500 + 120) / 2, rel=0.01)
    assert body["p50_latency_ms"] >= 120
    assert body["p95_latency_ms"] >= 500


def test_health_endpoint(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"ok", "degraded"}
    assert isinstance(body["azure_sql_connected"], bool)
    # Azure SQL is patched off → degraded + False
    assert body["status"] == "degraded"
    assert body["azure_sql_connected"] is False
