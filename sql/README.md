# ClearPath RAG — SQL setup

This folder contains every T-SQL script the backend needs.
**Run them in numeric order** on the same database (`ProjectClearPath` by default).

The active scripts depend on which **`AI_PROVIDER`** you pick in `.env`:

| `AI_PROVIDER` value  | What does the AI work? | SQL scripts to run |
|----------------------|-----------------------|---------------------|
| **`openrouter`** *(default)* or `azure_python` | Python (FastAPI) embeds + chats, FTS runs in SQL | `001`, `002`, `011` |
| `azure` (legacy)    | Azure SQL stored procedures (needs Azure SQL 2025) | `001`, `002`, `003`, `004`, `005`, `006`, `007`, `008`, `009` |

> **Recommendation: `openrouter`.** No Azure SQL 2025 required, no
> `sp_invoke_external_rest_endpoint`, no DB-scoped credentials. Pure local
> SQL Server + Python. See [Local AI setup guide](../docs/LOCAL_AI_SETUP.md).

---

## Always run (both modes)

| # | File | What it does |
|---|------|--------------|
| 1 | [`001_schema_clinical_cases.sql`](001_schema_clinical_cases.sql) | Creates the `ClinicalCases` table and bulk-loads sample data. |
| 2 | [`002_fulltext_search_setup.sql`](002_fulltext_search_setup.sql) | Creates the full-text catalog and index used for keyword search. |

## OpenRouter / Azure-Python mode (recommended)

| # | File | What it does |
|---|------|--------------|
| 3 | [`011_embeddings_table_python.sql`](011_embeddings_table_python.sql) | Creates `ClinicalCaseEmbeddings` with a `NVARCHAR(MAX)` JSON column (no `VECTOR` type needed). |

After running #1–#3, populate the embeddings from the backend:

```bash
cd backend
.venv\Scripts\Activate.ps1
python -m app.scripts.generate_embeddings
```

That script embeds every case via OpenRouter / Azure OpenAI and stores the
vectors in `ClinicalCaseEmbeddings.EmbeddingJson`. Re-running it is safe —
it upserts on `(CaseID, EmbeddingType)`.

## Legacy Azure SQL mode (`AI_PROVIDER=azure`)

These scripts only matter if you're running on Azure SQL 2025 and want the
old "SQL does everything" behaviour. They live alongside the new scripts for
easy comparison and to support the legacy path.

| # | File | What it does |
|---|------|--------------|
| 3 | [`003_master_key_and_credentials.sql`](003_master_key_and_credentials.sql) | DB master key + database-scoped credential for Azure OpenAI. |
| 4 | [`004_external_embedding_model.sql`](004_external_embedding_model.sql) | Registers Azure OpenAI as an external model in `sys.external_models`. |
| 5 | [`005_embeddings_table_and_generation.sql`](005_embeddings_table_and_generation.sql) | Creates the `VECTOR(1536)` table and embeds all 207 cases from inside SQL. |
| 6 | [`006_vector_index.sql`](006_vector_index.sql) | ANN vector index on the `VECTOR(1536)` column. |
| 7 | [`007_usp_find_similar_cases.sql`](007_usp_find_similar_cases.sql) | `usp_FindSimilarClinicalCases` — vector search SP. |
| 8 | [`008_usp_rrf_hybrid_search.sql`](008_usp_rrf_hybrid_search.sql) | `usp_RRFSearchClinicalCases` — vector + FTS, fused with RRF. |
| 9 | [`009_usp_rag_search.sql`](009_usp_rag_search.sql) | `usp_ClearPath_RAG_Search` — full RAG pipeline inside SQL. |
| 10 | [`010_verification_queries.sql`](010_verification_queries.sql) | Sanity-check queries. |

## Why we kept the Azure SQL scripts

* You can flip back to `AI_PROVIDER=azure` with a single env var.
* The vector+RRF+chat math is identical to the Python implementation, so
  the two paths are easy to compare during demos.

## Files intentionally **not** part of the new mode

| # | File | Status in OpenRouter mode |
|---|------|----------------------------|
| 5 | `005_embeddings_table_and_generation.sql` | **Skip** — Python does this via `generate_embeddings.py`. |
| 6 | `006_vector_index.sql` | **Skip** — 207 cases don't need an ANN index. |
| 7-9 | `007..009` | **Skip** — Python pipeline replaces these SPs. |
| 10 | `010_verification_queries.sql` | Optional — useful when validating the legacy path. |
