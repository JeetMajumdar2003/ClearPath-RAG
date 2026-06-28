"""Vector + keyword + hybrid search — Python implementation.

Replaces the three stored procedures that used to live in Azure SQL:

* :sql:`usp_FindSimilarClinicalCases`        — vector-only (cosine)
* :sql:`usp_RRFSearchClinicalCases`          — vector + FTS, fused with RRF
* :sql:`usp_ClearPath_RAG_Search`            — the above + LLM call

The implementation here is deliberately small. With 207 cases there is no
point pulling in ``numpy`` or maintaining an ANN index — pure-Python cosine
similarity completes in a few milliseconds.

The keyword (FTS) half of the hybrid search still runs in SQL Server via
``CONTAINSTABLE`` because every supported SQL Server edition ships full-text
search and the ``FTS_RANK`` value the engine returns is genuinely useful.
"""
from __future__ import annotations

import json
import math
import time
from typing import List, Tuple

import structlog

from app.core.config import settings
from app.db.azure_sql import get_clinical_connection

log = structlog.get_logger(__name__)


# --------------------------------------------------------------------------- helpers
def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Pure-Python cosine similarity. O(n) where n is the vector length.

    For the project's 1536-dim vectors over 207 cases this is ~318K multiplies —
    finishes in well under 10 ms on any modern CPU.
    """
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (math.sqrt(na) * math.sqrt(nb))


def _load_cases_with_embeddings(conn, embedding_type: str) -> List[dict]:
    """JOIN :sql:`ClinicalCases` with their stored embeddings."""
    sql = f"""
        SELECT c.CaseID, c.PatientAge, c.Gender, c.ChiefComplaint, c.Symptoms,
               c.MedicalHistory, c.Diagnosis, c.TreatmentPlan, c.Outcome, c.Severity,
               e.EmbeddingJson
        FROM {settings.clinical_cases_table} c
        INNER JOIN {settings.embeddings_table} e
            ON c.CaseID = e.CaseID
        WHERE e.EmbeddingType = ?
    """
    with conn.cursor() as cur:
        cur.execute(sql, (embedding_type,))
        names = [d[0] for d in cur.description]
        rows = cur.fetchall()
    return [dict(zip(names, row)) for row in rows]


def _keyword_search_fts(conn, query_text: str, top_k: int) -> List[Tuple[int, float]]:
    """FTS via ``CONTAINSTABLE`` — returns ``[(CaseID, FtsRank), ...]``.

    Falls back to a ``LIKE`` scan if FTS isn't installed on the local server,
    so the project still runs on Express Edition (which has FTS in 2017+).
    """
    sql = f"""
        SELECT TOP (?) c.CaseID, ft.[RANK] AS FtsRank
        FROM {settings.clinical_cases_table} c
        INNER JOIN CONTAINSTABLE(
            {settings.clinical_cases_table},
            (ChiefComplaint, Symptoms, MedicalHistory, Diagnosis, TreatmentPlan, Outcome),
            ?
        ) AS ft
            ON c.CaseID = ft.[KEY]
        ORDER BY ft.[RANK] DESC;
    """
    try:
        with conn.cursor() as cur:
            cur.execute(sql, (top_k, query_text))
            return [(int(r[0]), float(r[1])) for r in cur.fetchall()]
    except Exception as exc:
        log.warning("fts_fallback_to_like", error=str(exc))
        return _keyword_search_like(conn, query_text, top_k)


def _keyword_search_like(conn, query_text: str, top_k: int) -> List[Tuple[int, float]]:
    """Brute-force ``LIKE`` fallback for the rare case FTS isn't available."""
    like = f"%{query_text}%"
    sql = f"""
        SELECT TOP (?) CaseID,
               (CASE WHEN ChiefComplaint LIKE ? THEN 4 ELSE 0 END
              + CASE WHEN Symptoms        LIKE ? THEN 3 ELSE 0 END
              + CASE WHEN Diagnosis       LIKE ? THEN 3 ELSE 0 END
              + CASE WHEN TreatmentPlan   LIKE ? THEN 2 ELSE 0 END
              + CASE WHEN Outcome         LIKE ? THEN 1 ELSE 0 END) AS Score
        FROM {settings.clinical_cases_table}
        WHERE ChiefComplaint LIKE ? OR Symptoms LIKE ? OR Diagnosis LIKE ?
           OR TreatmentPlan LIKE ? OR Outcome LIKE ?
        ORDER BY Score DESC;
    """
    params = (top_k, like, like, like, like, like, like, like, like, like, like)
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return [(int(r[0]), float(r[1])) for r in cur.fetchall()]


def _rrf_fuse(
    ranked_lists: List[List[Tuple[int, float]]],
    weights: List[float],
    k: int,
) -> List[Tuple[int, float]]:
    """Reciprocal Rank Fusion.

    Each input list is ``[(case_id, score)]`` already sorted by score desc.
    The RRF score for case ``c`` is::

        sum( weight_i / (k + rank_i(c)) )   for every list i that contains c
    """
    fused: dict[int, float] = {}
    for rank_list, weight in zip(ranked_lists, weights):
        for rank, (case_id, _score) in enumerate(rank_list, start=1):
            fused[case_id] = fused.get(case_id, 0.0) + weight / (k + rank)
    return sorted(fused.items(), key=lambda kv: kv[1], reverse=True)


def _enrich_top_hits(
    raw_results: List[dict],
    *,
    vector_score_key: str | None = "Similarity",
    keyword_score_key: str | None = None,
    hybrid_score_key: str | None = None,
) -> List[dict]:
    """Strip the embedding JSON and attach similarity/score fields the API expects."""
    enriched: List[dict] = []
    for row in raw_results:
        out = {k: v for k, v in row.items() if k != "EmbeddingJson"}
        if vector_score_key and "Similarity" in out:
            out["VectorDistance"] = round(1.0 - float(out["Similarity"] or 0.0), 6)
        if hybrid_score_key and hybrid_score_key in out:
            out["HybridScore"] = round(float(out[hybrid_score_key] or 0.0), 6)
        enriched.append(out)
    return enriched


# --------------------------------------------------------------------------- public API
def vector_search(
    query_vec: List[float],
    top_k: int = 5,
    embedding_type: str = "FullCase",
) -> List[dict]:
    """Return the top-k most similar cases (cosine) for the given query vector."""
    with get_clinical_connection() as conn:
        cases = _load_cases_with_embeddings(conn, embedding_type)

    scored: list[dict] = []
    for c in cases:
        emb = json.loads(c.pop("EmbeddingJson") or "[]")
        sim = _cosine_similarity(query_vec, emb)
        c["Similarity"] = sim
        scored.append(c)
    scored.sort(key=lambda x: x["Similarity"], reverse=True)
    return scored[:top_k]


def keyword_search(query_text: str, top_k: int = 20) -> List[dict]:
    """FTS-only search — returns rows in ``FtsRank`` order with ``KeywordScore`` set."""
    with get_clinical_connection() as conn:
        ranked = _keyword_search_fts(conn, query_text, top_k)
    if not ranked:
        return []
    ids = [r[0] for r in ranked]
    scores = {r[0]: r[1] for r in ranked}
    placeholders = ",".join("?" for _ in ids)
    sql = f"""
        SELECT CaseID, PatientAge, Gender, ChiefComplaint, Symptoms,
               MedicalHistory, Diagnosis, TreatmentPlan, Outcome, Severity
        FROM {settings.clinical_cases_table}
        WHERE CaseID IN ({placeholders})
    """
    with get_clinical_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, ids)
            names = [d[0] for d in cur.description]
            rows = cur.fetchall()
    out: list[dict] = []
    for row in rows:
        d = dict(zip(names, row))
        d["KeywordScore"] = float(scores.get(d["CaseID"], 0.0))
        out.append(d)
    out.sort(key=lambda x: x["KeywordScore"], reverse=True)
    return out


def hybrid_search(
    query_text: str,
    query_vec: List[float],
    top_k: int = 5,
    embedding_type: str = "FullCase",
    vector_weight: float = 0.6,
    keyword_weight: float = 0.4,
    rrf_k: int = 60,
) -> List[dict]:
    """Vector + FTS fused with Reciprocal Rank Fusion. Returns top-k enriched rows."""
    # Pull a larger candidate set from each side so RRF has room to work.
    candidate_k = max(top_k * 4, 20)

    v_hits = vector_search(query_vec, top_k=candidate_k, embedding_type=embedding_type)
    k_hits = keyword_search(query_text, top_k=candidate_k)

    v_list = [(row["CaseID"], row["Similarity"]) for row in v_hits]
    k_list = [(row["CaseID"], row["KeywordScore"]) for row in k_hits]

    fused = _rrf_fuse([v_list, k_list], [vector_weight, keyword_weight], rrf_k)
    if not fused:
        return []

    # Pull the full case rows for the winners.
    top_ids = [cid for cid, _ in fused[:candidate_k]]
    sim_by_id = {row["CaseID"]: row["Similarity"] for row in v_hits}
    kw_by_id = {row["CaseID"]: row["KeywordScore"] for row in k_hits}
    hybrid_by_id = {cid: score for cid, score in fused}

    placeholders = ",".join("?" for _ in top_ids)
    sql = f"""
        SELECT CaseID, PatientAge, Gender, ChiefComplaint, Symptoms,
               MedicalHistory, Diagnosis, TreatmentPlan, Outcome, Severity
        FROM {settings.clinical_cases_table}
        WHERE CaseID IN ({placeholders})
    """
    with get_clinical_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, top_ids)
            names = [d[0] for d in cur.description]
            rows = cur.fetchall()
    rows_by_id = {dict(zip(names, row))["CaseID"]: dict(zip(names, row)) for row in rows}

    out: list[dict] = []
    for cid, _ in fused[:top_k]:
        row = rows_by_id.get(cid)
        if not row:
            continue
        row["Similarity"] = sim_by_id.get(cid, 0.0)
        row["VectorDistance"] = round(1.0 - float(row["Similarity"] or 0.0), 6)
        row["KeywordScore"] = kw_by_id.get(cid, 0.0)
        row["HybridScore"] = round(float(hybrid_by_id.get(cid, 0.0)), 6)
        out.append(row)
    return out


def get_clinical_case_count() -> int:
    """Used by the dashboard health check."""
    with get_clinical_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) FROM {settings.clinical_cases_table}")
            return int(cur.fetchone()[0])
