"""RAG service — dispatches to either:

* the **Python pipeline** (OpenRouter or Azure OpenAI called from Python) — default, ``AI_PROVIDER=openrouter`` / ``azure_python``
* the **legacy Azure SQL stored procedures** (Azure SQL 2025 only) — ``AI_PROVIDER=azure``

The public function names (``find_similar_cases``, ``rrf_search``, ``rag_search``)
and signatures are unchanged, so the REST API and the frontend keep working
with no edits.

Pipeline summary
----------------
``openrouter`` / ``azure_python`` (Python)::

    query ─▶ provider.embed() ─▶ cosine search in Python
                                (FTS in SQL via CONTAINSTABLE) ─▶ RRF ─▶ top-k
    top-k cases ─▶ provider.chat() ─▶ clinical summary

``azure`` (legacy SP path)::

    query ─▶ EXEC usp_ClearPath_RAG_Search @Query=?, @Keyword=?, @TopK=? ...
            └─ Azure SQL embeds, vector-searches, FTSs, RRFs, calls AOAI
"""
from __future__ import annotations

import time
from typing import List, Tuple

import structlog

from app.core.config import settings
from app.db.azure_sql import get_azure_sql_connection
from app.schemas import ClinicalCaseResult

log = structlog.get_logger(__name__)


# ===========================================================================
# System prompt — shared by every provider
# ===========================================================================
_CLINICAL_SUMMARY_SYSTEM = (
    "You are a clinical decision-support assistant. Use ONLY the retrieved clinical "
    "cases below to answer the clinician's question. If the retrieved cases do not "
    "contain enough information to answer, say so explicitly. Cite case IDs in square "
    "brackets (e.g. [12]) when making claims so the clinician can drill into the evidence."
)


# ===========================================================================
# Row parsing — shared by every path so the REST API always sees the same shape
# ===========================================================================
def _row_to_similar_case(row) -> ClinicalCaseResult:
    """Build a :class:`ClinicalCaseResult` from a raw row, dict, or tuple.

    Accepts a duck-typed object with ``.CaseID`` / ``.PatientAge`` / etc. attributes
    (the shape pyodbc returns for Azure SQL SPs) **and** a plain ``dict`` (the shape
    produced by :mod:`app.services.search_service`).
    """
    def _g(key: str, default=None):
        if isinstance(row, dict):
            for k, v in row.items():
                if k.lower() == key.lower():
                    return v
            return default
        return getattr(row, key, default)

    return ClinicalCaseResult(
        case_id=int(_g("CaseID", 0) or 0),
        patient_age=_g("PatientAge"),
        gender=_g("Gender"),
        chief_complaint=_g("ChiefComplaint"),
        diagnosis=_g("Diagnosis"),
        severity=_g("Severity"),
        treatment_plan=_g("TreatmentPlan"),
        similarity=_g("Similarity"),
        vector_distance=_g("VectorDistance"),
        keyword_score=_g("KeywordScore"),
        hybrid_score=_g("HybridScore"),
    )


def _rows_to_cases(rows) -> List[ClinicalCaseResult]:
    return [_row_to_similar_case(r) for r in rows]


# ===========================================================================
# Python pipeline — used by ``openrouter`` and ``azure_python`` modes
# ===========================================================================
def _python_find_similar_cases(provider, case_text: str, top_k: int, embedding_type: str) -> Tuple[List[ClinicalCaseResult], int]:
    """Pure-Python vector search: embed query, then cosine-rank locally."""
    from app.services import search_service  # local import to avoid cycles

    started = time.time()
    query_vec = provider.embed(case_text)
    raw = search_service.vector_search(query_vec, top_k, embedding_type)
    cases = _rows_to_cases(raw)
    latency_ms = int((time.time() - started) * 1000)
    log.info("python_vector_search", n_results=len(cases), latency_ms=latency_ms, provider=provider.name)
    return cases, latency_ms


def _python_rrf_search(
    provider,
    query_text: str,
    keyword_search: str,
    top_n: int,
    embedding_type: str,
    vector_weight: float,
    keyword_weight: float,
    rrf_k: int,
) -> Tuple[List[ClinicalCaseResult], int]:
    """Pure-Python RRF: vector + FTS, fused with Reciprocal Rank Fusion."""
    from app.services import search_service

    started = time.time()
    query_vec = provider.embed(query_text)
    raw = search_service.hybrid_search(
        query_text=keyword_search,
        query_vec=query_vec,
        top_k=top_n,
        embedding_type=embedding_type,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
        rrf_k=rrf_k,
    )
    cases = _rows_to_cases(raw)
    latency_ms = int((time.time() - started) * 1000)
    log.info("python_rrf_search", n_results=len(cases), latency_ms=latency_ms, provider=provider.name)
    return cases, latency_ms


def _python_rag_search(
    provider,
    patient_description: str,
    keyword_search: str,
    top_n: int,
    embedding_type: str,
    vector_weight: float,
    keyword_weight: float,
    rrf_k: int,
) -> Tuple[List[ClinicalCaseResult], str, int]:
    """Python RAG: hybrid retrieval + LLM summary."""
    from app.services import search_service

    started = time.time()
    query_vec = provider.embed(patient_description)
    raw_cases = search_service.hybrid_search(
        query_text=keyword_search,
        query_vec=query_vec,
        top_k=top_n,
        embedding_type=embedding_type,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
        rrf_k=rrf_k,
    )
    cases = _rows_to_cases(raw_cases)
    summary = _generate_clinical_summary(provider, patient_description, cases)
    latency_ms = int((time.time() - started) * 1000)
    log.info(
        "python_rag_search",
        n_results=len(cases),
        latency_ms=latency_ms,
        provider=provider.name,
        has_summary=bool(summary),
    )
    return cases, summary, latency_ms


def _generate_clinical_summary(provider, question: str, cases: List[ClinicalCaseResult]) -> str:
    """Format the retrieved cases into a context block and call the LLM."""
    if not cases:
        return (
            "No similar clinical cases were retrieved, so no evidence-based answer "
            "can be produced. Please broaden the keyword search or check the corpus."
        )
    context_lines: list[str] = []
    for c in cases:
        context_lines.append(
            f"[CaseID={c.case_id}] "
            f"Age: {c.patient_age}, Gender: {c.gender}, Severity: {c.severity}\n"
            f"  Chief complaint: {c.chief_complaint}\n"
            f"  Diagnosis: {c.diagnosis}\n"
            f"  Treatment: {c.treatment_plan}"
        )
    context = "\n\n".join(context_lines)
    user_prompt = (
        "Retrieved clinical cases:\n\n"
        f"{context}\n\n"
        f"Clinician's question: {question.strip()}\n\n"
        "Answer strictly from the cases above and cite case IDs in square brackets."
    )
    try:
        return provider.chat(
            system=_CLINICAL_SUMMARY_SYSTEM,
            user=user_prompt,
            temperature=0.2,
            max_tokens=800,
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("rag_summary_generation_failed", error=str(exc))
        return (
            "Retrieved similar cases successfully, but the clinical-summary model "
            f"could not be reached: {exc}. See the case cards below for the evidence."
        )


# ===========================================================================
# Legacy Azure SQL SP path — preserved unchanged, only used when
# ``AI_PROVIDER=azure`` (and the database is Azure SQL 2025 with the lab SPs).
# ===========================================================================
def _sp_find_similar_cases(case_text: str, top_k: int, embedding_type: str) -> Tuple[List[ClinicalCaseResult], int]:
    started = time.time()
    with get_azure_sql_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"EXEC {settings.sp_find_similar_cases} @Query=?, @TopK=?, @EmbeddingType=?",
                (case_text, top_k, embedding_type),
            )
            rows = cur.fetchall()
    cases = _rows_to_cases(rows)
    latency_ms = int((time.time() - started) * 1000)
    log.info("sp_vector_search", n_results=len(cases), latency_ms=latency_ms)
    return cases, latency_ms


def _sp_rrf_search(
    query_text: str,
    keyword_search: str,
    top_n: int,
    embedding_type: str,
    vector_weight: float,
    keyword_weight: float,
    rrf_k: int,
) -> Tuple[List[ClinicalCaseResult], int]:
    started = time.time()
    with get_azure_sql_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                EXEC {settings.sp_rrf_search}
                    @Query=?, @Keyword=?, @TopK=?, @EmbeddingType=?,
                    @VectorWeight=?, @KeywordWeight=?, @RRFK=?
                """,
                (
                    query_text, keyword_search, top_n, embedding_type,
                    vector_weight, keyword_weight, rrf_k,
                ),
            )
            rows = cur.fetchall()
    cases = _rows_to_cases(rows)
    latency_ms = int((time.time() - started) * 1000)
    log.info("sp_rrf_search", n_results=len(cases), latency_ms=latency_ms)
    return cases, latency_ms


def _sp_rag_search(
    patient_description: str,
    keyword_search: str,
    top_n: int,
    embedding_type: str,
    vector_weight: float,
    keyword_weight: float,
    rrf_k: int,
) -> Tuple[List[ClinicalCaseResult], str, int]:
    started = time.time()
    summary: str | None = None
    with get_azure_sql_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                EXEC {settings.sp_rag_search}
                    @Query=?, @Keyword=?, @TopK=?, @EmbeddingType=?,
                    @VectorWeight=?, @KeywordWeight=?, @RRFK=?
                """,
                (
                    patient_description, keyword_search, top_n, embedding_type,
                    vector_weight, keyword_weight, rrf_k,
                ),
            )
            rows = cur.fetchall()
            # SP returns a second result set: a single-row clinical summary.
            if cur.nextset():
                row = cur.fetchone()
                if row:
                    summary = row[0]
    cases = _rows_to_cases(rows)
    latency_ms = int((time.time() - started) * 1000)
    log.info("sp_rag_search", n_results=len(cases), latency_ms=latency_ms)
    return cases, (summary or ""), latency_ms


# ===========================================================================
# Public dispatcher API — signatures unchanged
# ===========================================================================
def get_clinical_case_count() -> int:
    """Total cases in the clinical table — used by the dashboard health check.

    In ``openrouter`` and ``azure_python`` modes we read from the local SQL
    Server; in ``azure`` mode we hit the Azure SQL database (the SP path).
    """
    from app.services.search_service import get_clinical_case_count as _local_count
    return _local_count()


def find_similar_cases(
    case_text: str, top_k: int, embedding_type: str
) -> Tuple[List[ClinicalCaseResult], int]:
    """Top-k similar cases for the given free-text query."""
    if settings.is_legacy_azure_sql_mode:
        return _sp_find_similar_cases(case_text, top_k, embedding_type)
    from app.services.provider_factory import get_ai_provider
    return _python_find_similar_cases(get_ai_provider(), case_text, top_k, embedding_type)


def rrf_search(
    query_text: str,
    keyword_search: str,
    top_n: int,
    embedding_type: str,
    vector_weight: float,
    keyword_weight: float,
    rrf_k: int,
) -> Tuple[List[ClinicalCaseResult], int]:
    """Vector + FTS hybrid search with Reciprocal Rank Fusion."""
    if settings.is_legacy_azure_sql_mode:
        return _sp_rrf_search(
            query_text, keyword_search, top_n, embedding_type,
            vector_weight, keyword_weight, rrf_k,
        )
    from app.services.provider_factory import get_ai_provider
    return _python_rrf_search(
        get_ai_provider(), query_text, keyword_search, top_n, embedding_type,
        vector_weight, keyword_weight, rrf_k,
    )


def rag_search(
    patient_description: str,
    keyword_search: str,
    top_n: int,
    embedding_type: str,
    vector_weight: float,
    keyword_weight: float,
    rrf_k: int,
) -> Tuple[List[ClinicalCaseResult], str, int]:
    """Full RAG: retrieve top-k cases and generate a clinical summary."""
    if settings.is_legacy_azure_sql_mode:
        return _sp_rag_search(
            patient_description, keyword_search, top_n, embedding_type,
            vector_weight, keyword_weight, rrf_k,
        )
    from app.services.provider_factory import get_ai_provider
    return _python_rag_search(
        get_ai_provider(), patient_description, keyword_search, top_n, embedding_type,
        vector_weight, keyword_weight, rrf_k,
    )
