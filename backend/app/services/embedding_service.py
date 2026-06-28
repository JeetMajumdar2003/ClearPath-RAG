"""Embedding generation + storage in Python.

This is the local-Server equivalent of the Azure SQL stored-procedure that
used to call ``AI_GENERATE_EMBEDDINGS`` + ``sp_invoke_external_rest_endpoint``
to populate :sql:`dbo.ClinicalCaseEmbeddings`.

Workflow:

1. Read every row of :sql:`dbo.ClinicalCases` (formatted for the chosen
   ``EmbeddingType`` — FullCase / SymptomsOnly / etc).
2. Call the configured :class:`AIProvider` in small batches to generate vectors.
3. Upsert the vectors back into :sql:`dbo.ClinicalCaseEmbeddings.EmbeddingJson`
   (a ``NVARCHAR(MAX)`` column containing a JSON array of floats).

This keeps the table portable: it works on any SQL Server 2017+ install —
no ``VECTOR(1536)`` type, no Azure SQL 2025 feature required.
"""
from __future__ import annotations

import json
import time
from typing import List, Tuple

import structlog

from app.core.config import settings
from app.db.azure_sql import get_clinical_connection
from app.services.ai_provider import AIProvider

log = structlog.get_logger(__name__)


# --------------------------------------------------------------------------- formatting
# Column lists per EmbeddingType — kept identical to the Azure SQL SP behaviour
# so the two pipelines produce comparable vectors.
_COLUMNS_BY_TYPE = {
    "FullCase": [
        "PatientAge", "Gender", "ChiefComplaint", "Symptoms", "MedicalHistory",
        "Diagnosis", "TreatmentPlan", "Outcome", "Severity",
    ],
    "SymptomsOnly": ["PatientAge", "Gender", "ChiefComplaint", "Symptoms", "Severity"],
    "DiagnosisOnly": ["PatientAge", "Gender", "ChiefComplaint", "Diagnosis", "Severity"],
    "TreatmentOnly": ["PatientAge", "Gender", "Diagnosis", "TreatmentPlan", "Severity"],
    "OutcomeOnly": ["PatientAge", "Gender", "Diagnosis", "TreatmentPlan", "Outcome", "Severity"],
}


def _format_case_text(row: dict, embedding_type: str) -> str:
    """Join the row's selected columns into a single string for embedding."""
    chunks: list[str] = []
    for col in _COLUMNS_BY_TYPE.get(embedding_type, _COLUMNS_BY_TYPE["FullCase"]):
        val = row.get(col)
        if val is None or val == "":
            continue
        chunks.append(f"{col}: {val}")
    return "\n".join(chunks)


def _fetch_all_cases(conn, embedding_type: str) -> List[dict]:
    """Read all cases for the given ``embedding_type`` (column subset)."""
    cols = _COLUMNS_BY_TYPE.get(embedding_type, _COLUMNS_BY_TYPE["FullCase"])
    col_list = ", ".join(f"[{c}]" for c in cols)
    sql = f"SELECT CaseID, {col_list} FROM {settings.clinical_cases_table}"
    with conn.cursor() as cur:
        cur.execute(sql)
        names = [d[0] for d in cur.description]
        rows = cur.fetchall()
    return [dict(zip(names, row)) for row in rows]


def _store_embedding(conn, case_id: int, embedding: List[float], embedding_type: str, model_name: str, dimensions: int) -> None:
    """Upsert the embedding into the embeddings table."""
    emb_json = json.dumps(embedding)
    sql = f"""
        MERGE {settings.embeddings_table} AS tgt
        USING (SELECT ? AS CaseID, ? AS EmbeddingType) AS src
          ON tgt.CaseID = src.CaseID AND tgt.EmbeddingType = src.EmbeddingType
        WHEN MATCHED THEN
            UPDATE SET EmbeddingJson   = ?,
                       EmbeddingModel  = ?,
                       Dimensions      = ?,
                       UpdatedAt       = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (CaseID, EmbeddingType, EmbeddingJson, EmbeddingModel, Dimensions, CreatedAt, UpdatedAt)
            VALUES (?, ?, ?, ?, ?, SYSUTCDATETIME(), SYSUTCDATETIME());
    """
    with conn.cursor() as cur:
        cur.execute(sql, (case_id, embedding_type, emb_json, model_name, dimensions,
                           case_id, embedding_type, emb_json, model_name, dimensions))
    conn.commit()


# --------------------------------------------------------------------------- public API
def generate_all_embeddings(
    provider: AIProvider,
    embedding_type: str = "FullCase",
    batch_size: int = 10,
) -> Tuple[int, int]:
    """Generate and persist embeddings for every case in ClinicalCases.

    Returns ``(success_count, failed_count)``.
    """
    started = time.time()
    with get_clinical_connection() as conn:
        cases = _fetch_all_cases(conn, embedding_type)
    log.info(
        "embedding_generation_start",
        total_cases=len(cases),
        embedding_type=embedding_type,
        provider=provider.name,
    )

    model_name = getattr(provider, "name_embed", provider.name)
    dimensions = provider.embed_dimensions
    success = 0
    failed = 0

    for i in range(0, len(cases), batch_size):
        batch = cases[i : i + batch_size]
        texts = [_format_case_text(c, embedding_type) for c in batch]
        try:
            embeddings = provider.embed_batch(texts)
            with get_clinical_connection() as conn:
                for case, emb in zip(batch, embeddings):
                    if len(emb) != dimensions:
                        raise ValueError(
                            f"Provider returned {len(emb)}-dim vector, expected {dimensions}. "
                            "Check OPENROUTER_EMBED_MODEL / OPENROUTER_EMBEDDING_DIMENSIONS."
                        )
                    _store_embedding(conn, case["CaseID"], emb, embedding_type, model_name, dimensions)
            success += len(batch)
            log.info(
                "embedding_batch_done",
                batch_start=i + 1,
                batch_end=i + len(batch),
                total_success=success,
            )
        except Exception as exc:
            failed += len(batch)
            log.error("embedding_batch_failed", batch_start=i + 1, error=str(exc))

    elapsed_ms = int((time.time() - started) * 1000)
    log.info(
        "embedding_generation_done",
        success=success,
        failed=failed,
        total=len(cases),
        elapsed_ms=elapsed_ms,
    )
    return success, failed


def embed_query_text(provider: AIProvider, text: str) -> List[float]:
    """Embed a single query string — used by :mod:`app.services.search_service`."""
    return provider.embed(text)
