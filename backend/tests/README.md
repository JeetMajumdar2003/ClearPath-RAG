# Backend Tests

Smoke tests covering the FastAPI surface area and the RAG service in isolation.
The tests run hermetically — no PostgreSQL or Azure SQL is required.

## Layout

| File | Coverage |
|------|----------|
| `conftest.py` | Shared fixtures — in-memory SQLite DB, dependency overrides, Azure SQL mocks, test user + token helpers. |
| `test_security.py` | Password hashing + JWT encode/decode round-trip. |
| `test_auth.py` | `/auth/register`, `/auth/login`, `/auth/me` — happy paths + 401/422 failures. |
| `test_rag.py` | RAG service direct calls (vector, hybrid, full RAG) with pyodbc mocked; `/rag/query` success + error log; `/rag/config` get/put + admin RBAC. |
| `test_dashboard_logs.py` | `/dashboard/overview`, `/logs` filtering & pagination, `/analytics/usage`, `/analytics/performance`, `/health`. |

## Running

From the repository root:

```bash
docker compose exec backend pytest -v
```

Or from `backend/` directly:

```bash
cd backend
pip install -r requirements.txt
python -m pytest -v
```

No `.env` is required — the conftest injects safe defaults (`SQL_SERVER=""`,
`SECRET_KEY="test-..."`). Tests that would otherwise hit Azure SQL are mocked at
the source module (`app.db.azure_sql.check_azure_sql_connection` and
`app.services.rag_service.get_azure_sql_connection`).

## Design notes

- **SQLite Enum swap**: SQLAlchemy `Enum` columns aren't supported on SQLite.
  `conftest.py` rewrites the two `Enum` columns (`User.role`, `QueryLog.query_type`,
  `QueryLog.status`) to plain `VARCHAR(50)` for the test session only — the
  production Postgres schema is unchanged.
- **No real bcrypt at runtime in tests**: bcrypt is used by the production
  `get_password_hash`, which is invoked via `create_user` in fixtures. This is
  fast enough for a few users; if startup becomes a concern, stub it.
- **SlowAPI rate limiter** is still active in tests. With the in-process
  `TestClient` the per-IP counter is per-test, so `10/minute` is comfortably
  not hit by the suite.
