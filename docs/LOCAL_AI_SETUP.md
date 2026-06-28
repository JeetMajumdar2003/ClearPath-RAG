# ClearPath RAG — Local AI setup guide

This guide explains how to run the platform end-to-end on a **local SQL Server**
with **OpenRouter** for embeddings + chat. No Azure resources required.

> Want to switch back to Azure? Set `AI_PROVIDER=azure` and run the legacy
> SQL scripts in [`sql/`](../sql/README.md). The code is identical; only the
> dispatch table in [`app/services/rag_service.py`](../backend/app/services/rag_service.py)
> changes.

---

## 1. Prerequisites

* **SQL Server 2017+** (Express, Developer, or full — any edition with FTS)
  running on `localhost:1433` (default). Docker option below.
* **Python 3.11+** with the backend virtualenv set up.
* **An OpenRouter account** (free, no credit card). Sign up at
  <https://openrouter.ai/> and copy an API key from <https://openrouter.ai/keys>.

## 2. Start SQL Server (Docker, easiest)

```bash
docker run -d --name clearpath-sql \
  -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=YourStrong!Passw0rd" \
  -p 1433:1433 \
  mcr.microsoft.com/mssql/server:2022-latest
```

Wait ~15s for SQL Server to be ready, then verify:

```bash
docker exec -it clearpath-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'YourStrong!Passw0rd' -C -Q "SELECT @@VERSION"
```

## 3. Configure `.env`

```bash
cp .env.example .env
```

Open `.env` and confirm / change these four lines (everything else can stay
default):

```dotenv
# Local SQL Server
SQL_SERVER=localhost
SQL_USERNAME=sa
SQL_PASSWORD=YourStrong!Passw0rd
SQL_ENCRYPT=no
SQL_TRUST_SERVER_CERTIFICATE=yes

# OpenRouter (free key from https://openrouter.ai/keys)
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENROUTER_CHAT_MODEL=nvidia/nemotron-3-super-120b-a12b:free
OPENROUTER_EMBED_MODEL=nvidia/llama-nemotron-embed-vl-1b-v2:free
```

> The default chat model is free. The embedding model is paid but essentially
> free (~$0.02 per 1M tokens — your 207 cases cost well under $0.001).

## 4. Run the SQL scripts

The [`sql/`](../sql) folder documents the order. For OpenRouter mode you only
need three files:

```bash
docker exec -i clearpath-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'YourStrong!Passw0rd' -C -Q "CREATE DATABASE ProjectClearPath;"

# 1. Cases table + sample data
docker exec -i clearpath-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'YourStrong!Passw0rd' -C -d ProjectClearPath \
  -i sql/001_schema_clinical_cases.sql

# (Edit the BULK INSERT path in 001 to point at data/ClinicalCases.csv
#  or load data/ClinicalCases.csv via Azure Data Studio / SSMS.)

# 2. Full-text index
docker exec -i clearpath-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'YourStrong!Passw0rd' -C -d ProjectClearPath \
  -i sql/002_fulltext_search_setup.sql

# 3. Embeddings table (Python stores JSON here, no VECTOR type)
docker exec -i clearpath-sql /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P 'YourStrong!Passw0rd' -C -d ProjectClearPath \
  -i sql/011_embeddings_table_python.sql
```

## 5. Start the backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1      # Windows
# source .venv/bin/activate     # macOS / Linux

pip install -r requirements.txt

# Apply metadata migrations + seed admin
alembic upgrade head
python -m app.scripts.seed_admin

uvicorn app.main:app --reload
```

Visit <http://localhost:8000/docs> for the Swagger UI and confirm the health
endpoint reports `azure_sql_connected: true` (the field name is historical —
it's actually the clinical SQL Server).

## 6. Generate embeddings (one-time per embedding type)

```bash
# default FullCase
python -m app.scripts.generate_embeddings

# other types — re-run with --type
python -m app.scripts.generate_embeddings --type SymptomsOnly
python -m app.scripts.generate_embeddings --type DiagnosisOnly
```

Expected output:

```text
Provider : openrouter:NVIDIA
Embedding: openrouter:nvidia/llama-nemotron-embed-vl-1b-v2:free  (2048 dims)
Type     : FullCase
Batch    : 10

Done. success=207  failed=0
```

The script is **idempotent** — re-running it upserts rows.

## 7. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>, log in with the seeded admin, and try the
**RAG Console** — your answer will now come from a free Llama model
hosted on OpenRouter, grounded in the local SQL Server data.

---

## Switching back to Azure

```dotenv
AI_PROVIDER=azure
```

…and run the legacy SQL scripts in [`sql/003` … `sql/009`](../sql). The
backend will automatically route through the original stored procedures
(no code changes, no restart of the FastAPI process required for the new
configs — the `lru_cache` on the provider invalidates on process restart).

You can also try the **Azure OpenAI from Python** path with no SQL changes:

```dotenv
AI_PROVIDER=azure_python
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-small
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o
```

This keeps the Python pipeline but swaps the HTTP target from
`api.openrouter.ai` to your Azure resource — useful for production
when you have an existing Azure OpenAI commitment.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `RuntimeError: OpenRouter embeddings failed … 401` | Bad or missing `OPENROUTER_API_KEY` | Get a fresh key from <https://openrouter.ai/keys> |
| `Provider returned 2048-dim vector, expected 1536` | `OPENROUTER_EMBED_MODEL` returns a different size | Set `OPENROUTER_EMBEDDING_DIMENSIONS` and `EMBEDDING_VECTOR_DIMENSIONS` to the returned size, then regenerate embeddings |
| `/health` reports `azure_sql_connected: false` | Can't reach SQL Server | Check `SQL_SERVER`, port 1433, firewall, and that the container is running |
| `FTS catalog not found` | Step 2 (`002`) not run | Run it (or skip — the Python pipeline falls back to `LIKE`) |
| Chat returns 429 | OpenRouter rate-limit on the free model | Swap to another free model, e.g. `google/gemini-2.0-flash-exp:free` |
