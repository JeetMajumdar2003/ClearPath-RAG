# ClearPath RAG — API Reference

Base URL: `http://localhost:8000` (development)

All `/api/v1/*` routes require a JWT in the `Authorization: Bearer <token>` header except
`/api/v1/auth/login` and `/api/v1/auth/register`. The `/health` endpoint is unauthenticated.

OpenAPI / Swagger UI: <http://localhost:8000/docs>

---

## Auth

### `POST /api/v1/auth/register`

Create a new user. Default role is `clinician`.

Request:

```json
{
  "email": "user@hospital.org",
  "password": "supersecret",
  "full_name": "Dr. Jane Doe"
}
```

Response `201`:

```json
{
  "id": 2,
  "email": "user@hospital.org",
  "full_name": "Dr. Jane Doe",
  "role": "clinician",
  "is_active": true,
  "created_at": "2026-06-20T14:22:18.421Z"
}
```

### `POST /api/v1/auth/login`

OAuth2 password flow. Form fields:

| Field | Value |
|-------|-------|
| `username` | email |
| `password` | password |

Response `200`:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": { "id": 2, "email": "...", "full_name": "...", "role": "clinician", "is_active": true, "created_at": "..." }
}
```

### `GET /api/v1/auth/me`

Returns the current authenticated user.

---

## RAG

### `POST /api/v1/rag/query`

Full RAG pipeline: hybrid retrieval + GPT-4o summary.

Rate limited to **10 requests/minute per IP**.

Request:

```json
{
  "patient_description": "62-year-old male with chest pain radiating to left arm, ECG shows ST elevation",
  "keyword_search": "myocardial infarction",
  "top_n": 5,
  "embedding_type": "FullCase",
  "vector_weight": 0.6,
  "keyword_weight": 0.4,
  "rrf_k": 60
}
```

Response `200`:

```json
{
  "cases": [
    {
      "case_id": 17,
      "patient_age": 58,
      "gender": "M",
      "chief_complaint": "Crushing substernal chest pain",
      "diagnosis": "Acute MI",
      "severity": "High",
      "treatment_plan": "Aspirin + cath lab",
      "similarity": 0.94,
      "vector_distance": 0.06,
      "keyword_score": null,
      "hybrid_score": null
    }
  ],
  "clinical_summary": "Patient presentation is consistent with...",
  "latency_ms": 842
}
```

Errors: `502` if the stored procedure raises an error (logged with full detail).

### `POST /api/v1/rag/search/vector`

Vector-only search (`usp_FindSimilarClinicalCases`).

Request:

```json
{
  "case_text": "Patient presents with sudden severe headache and photophobia",
  "top_k": 5,
  "embedding_type": "FullCase"
}
```

Response: `{ "cases": [...], "latency_ms": 120 }`

### `POST /api/v1/rag/search/hybrid`

Hybrid RRF search (`usp_RRFSearchClinicalCases`).

Request:

```json
{
  "query_text": "Patient with productive cough and fever for 5 days",
  "keyword_search": "pneumonia fever cough",
  "top_n": 10,
  "embedding_type": "FullCase",
  "vector_weight": 0.6,
  "keyword_weight": 0.4,
  "rrf_k": 60
}
```

### `GET /api/v1/rag/config`

Returns the current runtime RAG defaults (one row per key).

### `PUT /api/v1/rag/config`

Update runtime RAG defaults. **Admin role required** (`403` otherwise).

Request (all fields optional):

```json
{
  "top_n": 8,
  "embedding_type": "DiagnosisOnly",
  "vector_weight": 0.7,
  "keyword_weight": 0.3,
  "rrf_k": 60
}
```

---

## Dashboard

### `GET /api/v1/dashboard/overview`

Aggregate KPIs for the home dashboard.

Response:

```json
{
  "queries_today": 12,
  "total_queries": 348,
  "avg_latency_ms": 612.4,
  "success_rate": 98.6,
  "clinical_case_count": 1000,
  "azure_sql_connected": true
}
```

---

## Logs

### `GET /api/v1/logs`

Paginated, filterable audit trail.

| Query param | Type | Default | Notes |
|-------------|------|---------|-------|
| `page` | int | 1 |  |
| `page_size` | int | 20 | max 100 |
| `status` | enum | — | `success` / `error` |
| `query_type` | enum | — | `rag` / `vector` / `hybrid` |

Response:

```json
{
  "items": [
    {
      "id": 348,
      "user_id": 2,
      "user_email": "user@hospital.org",
      "query_type": "rag",
      "patient_description": "...",
      "keyword_search": "...",
      "top_n": 5,
      "embedding_type": "FullCase",
      "vector_weight": 0.6,
      "keyword_weight": 0.4,
      "latency_ms": 842,
      "status": "success",
      "error_message": null,
      "created_at": "2026-06-20T14:25:33.881Z"
    }
  ],
  "total": 348,
  "page": 1,
  "page_size": 20
}
```

---

## Analytics

### `GET /api/v1/analytics/usage?days=30`

Daily usage time-series plus a per-query-type breakdown.

Response:

```json
{
  "daily": [{ "date": "2026-05-21", "count": 7, "query_type": null }, ...],
  "by_type": [
    { "date": "", "count": 180, "query_type": "rag" },
    { "date": "", "count": 120, "query_type": "vector" },
    { "date": "", "count": 48,  "query_type": "hybrid" }
  ]
}
```

### `GET /api/v1/analytics/performance?days=30`

Latency stats and error counts.

Response:

```json
{
  "avg_latency_ms": 612.4,
  "p50_latency_ms": 530,
  "p95_latency_ms": 1240,
  "error_count": 5,
  "success_count": 343
}
```

---

## Health

### `GET /health`

Liveness + Azure SQL connectivity check. Unauthenticated.

Response:

```json
{
  "status": "ok",
  "azure_sql_connected": true
}
```

`status` is `"ok"` when Azure SQL is reachable, otherwise `"degraded"`.

---

## Error Format

All errors follow the standard FastAPI shape:

```json
{ "detail": "Invalid credentials" }
```

| Code | Meaning |
|------|---------|
| `400` | Validation error or duplicate email on register |
| `401` | Missing / invalid JWT |
| `403` | Authenticated but lacks required role (admin) |
| `422` | Request body fails Pydantic validation |
| `429` | Rate limit exceeded (`/rag/query`) |
| `502` | Upstream SQL stored procedure raised an error |
| `5xx` | Unexpected backend failure |

## Auth Header

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES` (default 1440 minutes / 24 hours).