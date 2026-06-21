# Azure SQL Migration Scripts

Numbered scripts for Project ClearPath RAG deployment on Azure SQL Database.

## Prerequisites (Lab 2 — Azure Portal)

Before running SQL scripts, deploy in Azure:

1. **Azure SQL Database** — `ProjectClearPath` (or your database name)
2. **Azure OpenAI** resource with deployments:
   - `text-embedding-3-small` (embeddings)
   - `gpt-4o` (chat completions)
3. **Managed Identity** on Azure SQL Server with `Cognitive Services OpenAI User` role on Azure OpenAI

## Execution Order

| Script | Description |
|--------|-------------|
| [001_schema_clinical_cases.sql](001_schema_clinical_cases.sql) | ClinicalCases table DDL |
| [002_fulltext_search_setup.sql](002_fulltext_search_setup.sql) | Full-text catalog and index |
| [003_master_key_and_credentials.sql](003_master_key_and_credentials.sql) | Master key + scoped credential |
| [004_external_embedding_model.sql](004_external_embedding_model.sql) | External embedding model |
| [005_embeddings_table_and_generation.sql](005_embeddings_table_and_generation.sql) | Embeddings table + generation |
| [006_vector_index.sql](006_vector_index.sql) | Cosine vector index |
| [007_usp_find_similar_cases.sql](007_usp_find_similar_cases.sql) | Vector search stored procedure |
| [008_usp_rrf_hybrid_search.sql](008_usp_rrf_hybrid_search.sql) | Hybrid RRF search stored procedure |
| [009_usp_rag_search.sql](009_usp_rag_search.sql) | Full RAG stored procedure |
| [010_verification_queries.sql](010_verification_queries.sql) | Health checks |

## Placeholders to Replace

Update these in scripts **003**, **004**, and **009** before running:

- `https://your-resource.openai.azure.com` — your Azure OpenAI endpoint
- Embedding and chat target URIs with your deployment names
- `AzureSQLAI2026` — master key password (match `.env` `SQL_MASTER_KEY_PASSWORD`)

## Data Seeding

Clinical case data may already exist from the workshop. To import from CSV:

```sql
-- Use SSMS Import Wizard or BULK INSERT with data/SQLQuery1.csv
```

## Idempotency

Scripts use `IF NOT EXISTS`, `CREATE OR ALTER`, and conditional inserts where possible. Safe to re-run on an existing lab deployment — run `010_verification_queries.sql` to confirm state.

## Connection from Web App

The FastAPI backend connects via ODBC using credentials in root `.env`. It calls stored procedures; it does not execute these migration scripts at runtime.
