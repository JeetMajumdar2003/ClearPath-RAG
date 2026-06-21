import time
from typing import Any

from app.db.azure_sql import get_azure_sql_connection
from app.schemas import ClinicalCaseResult


def _row_to_case(row: tuple, columns: list[str]) -> ClinicalCaseResult:
    data = dict(zip(columns, row, strict=False))
    return ClinicalCaseResult(
        case_id=int(data.get("CaseID") or data.get("case_id") or 0),
        patient_age=data.get("PatientAge"),
        gender=data.get("Gender"),
        chief_complaint=data.get("ChiefComplaint"),
        diagnosis=data.get("Diagnosis"),
        severity=data.get("Severity"),
        treatment_plan=data.get("TreatmentPlan"),
        similarity=float(data["Similarity"]) if data.get("Similarity") is not None else None,
        vector_distance=float(data["VectorDistance"]) if data.get("VectorDistance") is not None else None,
        keyword_score=float(data["KeywordScore"]) if data.get("KeywordScore") is not None else None,
        hybrid_score=float(data["HybridScore"]) if data.get("HybridScore") is not None else None,
    )


def _fetch_cases(cursor) -> list[ClinicalCaseResult]:
    if not cursor.description:
        return []
    columns = [col[0] for col in cursor.description]
    return [_row_to_case(row, columns) for row in cursor.fetchall()]


def find_similar_cases(case_text: str, top_k: int, embedding_type: str) -> tuple[list[ClinicalCaseResult], int]:
    start = time.perf_counter()
    with get_azure_sql_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "{CALL dbo.usp_FindSimilarClinicalCases (?, ?, ?)}",
            (case_text, top_k, embedding_type),
        )
        cases = _fetch_cases(cursor)
    latency_ms = int((time.perf_counter() - start) * 1000)
    return cases, latency_ms


def rrf_search(
    query_text: str,
    keyword_search: str,
    top_n: int,
    embedding_type: str,
    vector_weight: float,
    keyword_weight: float,
    rrf_k: int,
) -> tuple[list[ClinicalCaseResult], int]:
    start = time.perf_counter()
    with get_azure_sql_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "{CALL dbo.usp_RRFSearchClinicalCases (?, ?, ?, ?, ?, ?, ?)}",
            (query_text, keyword_search, top_n, embedding_type, vector_weight, keyword_weight, rrf_k),
        )
        cases = _fetch_cases(cursor)
    latency_ms = int((time.perf_counter() - start) * 1000)
    return cases, latency_ms


def rag_search(
    patient_description: str,
    keyword_search: str,
    top_n: int,
    embedding_type: str,
    vector_weight: float,
    keyword_weight: float,
    rrf_k: int,
) -> tuple[list[ClinicalCaseResult], str | None, int]:
    start = time.perf_counter()
    with get_azure_sql_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "{CALL dbo.usp_ClearPath_RAG_Search (?, ?, ?, ?, ?, ?, ?)}",
            (patient_description, keyword_search, top_n, embedding_type, vector_weight, keyword_weight, rrf_k),
        )
        cases = _fetch_cases(cursor)
        clinical_summary = None
        if cursor.nextset():
            row = cursor.fetchone()
            if row:
                clinical_summary = row[0]
    latency_ms = int((time.perf_counter() - start) * 1000)
    return cases, clinical_summary, latency_ms


def get_clinical_case_count() -> int | None:
    try:
        with get_azure_sql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM dbo.ClinicalCases")
            row = cursor.fetchone()
            return int(row[0]) if row else None
    except Exception:
        return None
