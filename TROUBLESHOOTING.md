# Troubleshooting

This guide is the expanded, searchable version of the troubleshooting section
in [`README.md`](README.md#troubleshooting). When you hit a problem, start
here — most symptoms are listed with their likely cause and fix.

> **Tip:** before diving in, confirm you're on the latest `main` branch and
> re-pull the container images with `docker compose pull && docker compose up
> --build`. Many issues are caused by stale images.

---

## 1. `docker compose up` fails immediately

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `bind: address already in use` on 5432 / 8000 / 5173 | A previous run is still bound | `docker compose down` (add `-v` to wipe the postgres volume) |
| `Cannot connect to the Docker daemon` | Docker Desktop not running | Start Docker Desktop, wait for the whale icon to settle |
| `ERROR: failed to solve: ... msodbcsql18 ...` on backend build | Old Docker / buildx without `--network=host` | `docker compose build --no-cache` after updating Docker Desktop |
| `no space left on device` | The Docker volume for `postgres_data` filled the disk | `docker system df` to inspect, then `docker volume prune` |
| Backend exits with code `137` immediately on Apple Silicon | Emulated x86_64 build of `msodbcsql18` ran out of memory | Increase Docker Desktop memory to ≥ 4 GB, or use a native ARM build |

### Wipe and start over

```bash
docker compose down -v              # stop + remove volumes
docker image prune -af               # clear stale backend/frontend images
docker compose up --build           # rebuild from scratch
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.scripts.seed_admin
```

---

## 2. `alembic upgrade head` fails

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `psycopg2.OperationalError: could not connect to server` | Postgres container not healthy yet | `docker compose ps` until `postgres` says `(healthy)`, then retry |
| `password authentication failed for user "clearpath"` | You changed `POSTGRES_*` after the volume was created | `docker compose down -v` to wipe the volume, then `up` again |
| `relation "users" does not exist` on first call | Migrations weren't run | `docker compose exec backend alembic upgrade head` |
| `alembic.util.exc.CommandError: Can't locate revision identified by '001'` | You copied only some files | Make sure `backend/alembic/versions/001_initial_schema.py` is present |

---

## 3. `seed_admin` complains

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Admin user already exists` | Idempotent — already seeded | Safe to ignore, or `DELETE FROM users WHERE email='admin@clearpath.local';` to reset |
| `ValidationError` on `ADMIN_EMAIL` | Email format invalid in `.env` | Make sure it's a valid email string |
| `Password too short` | `ADMIN_PASSWORD` < 8 chars | Update `.env` to a longer value |

---

## 4. RAG queries fail with `502 Bad Gateway`

The stored procedure is the bottleneck for almost every RAG failure — and it
returns the original SQL error to the API, which wraps it as a 502. To get the
real reason:

```bash
docker compose logs backend | grep -i "sp_invoke\|odbc\|sqlstate"
```

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `SSL Provider: ... certificate verify failed` | `SQL_TRUST_SERVER_CERTIFICATE=no` against a self-signed / private CA cert | Set `SQL_TRUST_SERVER_CERTIFICATE=yes` for dev, or install the proper CA bundle |
| `Login failed for user 'SQLAdmin'` | Wrong `SQL_USERNAME` / `SQL_PASSWORD` | Verify in SSMS with the same credentials |
| `Cannot find either column "dbo" or the user-defined function ...` | Migration `sql/001` not run | Re-run from `sql/001` through `sql/009` in order |
| `External model 'embedding_openai_text3_small' not found` | Migration `sql/004` not run | Run `004` then verify `SELECT * FROM sys.external_models;` |
| `sp_invoke_external_rest_endpoint ... 401 Unauthorized` | SQL managed identity lacks **Cognitive Services OpenAI User** on the AOAI resource | Add the role assignment in the Azure Portal → AOAI → Access Control (IAM) |
| `sp_invoke_external_rest_endpoint ... 404 Not Found` | Wrong `AZURE_OPENAI_CHAT_TARGET_URI` (deployment name or api-version) | Verify the deployment exists in Microsoft Foundry and the URL matches the blade |
| `sp_invoke_external_rest_endpoint ... 429 Too Many Requests` | You hit the AOAI TPM quota | Request a quota increase in the Azure Portal → AOAI → Quotas |
| RAG succeeds but `clinical_summary` is empty | GPT-4o throttling or region mismatch | Check AOAI metrics blade; verify the deployment's region matches the SQL DB's outbound allow-list |

---

## 5. "No clinical cases found"

- Confirm the seed data was bulk-inserted:
  ```sql
  SELECT COUNT(*) FROM dbo.ClinicalCases;            -- expect >= 207
  SELECT COUNT(*) FROM dbo.ClinicalCaseEmbeddings;  -- expect >= 414
  ```
- If the SP returns rows but the frontend shows none, open browser dev tools
  — a 502 here usually means `pyodbc` couldn't connect (driver missing or
  DSN mismatch).
- Re-run `sql/010_verification_queries.sql` — it surfaces missing objects
  and row-count sanity checks.

---

## 6. Frontend can't reach the API

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Network Error` / `ERR_CONNECTION_REFUSED` in DevTools | Backend not running, or `VITE_API_URL` wrong | Confirm `http://localhost:8000/api/v1/health` works in your browser. Restart `npm run dev` after editing `frontend/.env` |
| `CORS policy: No 'Access-Control-Allow-Origin' header` | `CORS_ORIGINS` in `.env` doesn't match the frontend origin | Add the exact frontend origin (e.g. `http://localhost:5173`) to `CORS_ORIGINS` and rebuild the backend |
| Login works but every other call returns `401` | Token expired (24h default) or stored user got out of sync | Sign out and back in. Confirm `localStorage.cp_token` in DevTools |
| `403 Forbidden` on Settings save | Logged in as clinician, not admin | Sign in with the admin account from `.env`, or promote the user in PostgreSQL: `UPDATE users SET role='admin' WHERE email='…';` |
| White page after navigating to `/app/*` | React Router base path mismatch | If you serve from a subpath, set `base` in `frontend/vite.config.ts` and rebuild |

---

## 7. Tests failing locally

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `ImportError: No module named app` | Ran from outside `backend/` | `cd backend && pytest` |
| `sqlalchemy.exc.OperationalError: no such table` | `conftest.py` not loaded | Make sure `pytest.ini` exists and `testpaths = tests` |
| `bcrypt 5.x compatibility warning` | Newer bcrypt than `4.2.1` pinned in `requirements.txt` | `pip install 'bcrypt==4.2.1'` to match |
| `pyodbc.InterfaceError: Driver not found` (local Linux) | `msodbcsql18` not installed | Follow the [local dev ODBC install steps](README.md#backend) in the README |
| Random `pydantic.ValidationError` on startup | A new env var in `.env.example` is missing from your local `.env` | Re-copy `.env.example` and re-fill |

---

## 8. Performance

- **First RAG query is slow (5–10 s)** — expected: GPT-4o cold start plus
  embedding lookup. Subsequent queries typically 800 ms – 1.5 s.
- **p95 > 3 s** — check the AOAI deployment's tokens-per-minute limit; you
  may need to request a quota increase.
- **`clinical_summary` returns immediately but cases are missing** — the SP
  is timing out. Inspect with `backend/app/scripts/inspect_sps.py` and run
  the SP manually in SSMS.

---

## 9. Logging tips

```bash
# Follow only the backend logs
docker compose logs -f backend

# Filter for errors
docker compose logs backend | grep -i "error\|exception\|traceback"

# Last 100 lines, with timestamps
docker compose logs --tail=100 -t backend
```

The backend emits structured JSON via `structlog`. Pipe through `jq` for
pretty-printing:

```bash
docker compose logs backend | jq '.'
```

---

## 10. Still stuck?

- Re-read the relevant section of [`README.md`](README.md).
- Search [existing issues](../../issues) — your bug may already be tracked.
- Open a new issue using the
  [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).
- For sensitive disclosures, follow [`SECURITY.md`](SECURITY.md).
