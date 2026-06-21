from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_admin
from app.core.config import settings
from app.db.session import get_db
from app.models import QueryStatus, QueryType, RagConfig, User
from app.schemas import (
    HybridSearchRequest,
    RagConfigItem,
    RagConfigUpdate,
    RagQueryRequest,
    RagQueryResponse,
    SearchResponse,
    VectorSearchRequest,
)
from app.services.analytics_service import log_query
from app.services import rag_service

router = APIRouter(prefix="/rag", tags=["rag"])
limiter = Limiter(key_func=get_remote_address)

DEFAULT_CONFIG_KEYS = {
    "top_n": str(settings.search_default_top_n),
    "embedding_type": settings.embedding_type_default,
    "vector_weight": str(settings.rrf_vector_weight),
    "keyword_weight": str(settings.rrf_keyword_weight),
    "rrf_k": str(settings.rrf_k),
}


def _get_config_value(db: Session, key: str) -> str:
    row = db.query(RagConfig).filter(RagConfig.key == key).first()
    if row:
        return row.value
    return DEFAULT_CONFIG_KEYS.get(key, "")


@router.post("/query", response_model=RagQueryResponse)
@limiter.limit("10/minute")
def rag_query(
    request: Request,
    payload: RagQueryRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        cases, summary, latency = rag_service.rag_search(
            payload.patient_description,
            payload.keyword_search,
            payload.top_n,
            payload.embedding_type,
            payload.vector_weight,
            payload.keyword_weight,
            payload.rrf_k,
        )
        log_query(
            db, user.id, QueryType.rag, payload.patient_description, payload.keyword_search,
            payload.top_n, payload.embedding_type, payload.vector_weight, payload.keyword_weight,
            latency, QueryStatus.success,
        )
        return RagQueryResponse(cases=cases, clinical_summary=summary, latency_ms=latency)
    except Exception as exc:
        log_query(
            db, user.id, QueryType.rag, payload.patient_description, payload.keyword_search,
            payload.top_n, payload.embedding_type, payload.vector_weight, payload.keyword_weight,
            None, QueryStatus.error, str(exc),
        )
        raise HTTPException(status_code=502, detail=f"RAG query failed: {exc}") from exc


@router.post("/search/vector", response_model=SearchResponse)
def vector_search(
    payload: VectorSearchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        cases, latency = rag_service.find_similar_cases(payload.case_text, payload.top_k, payload.embedding_type)
        log_query(
            db, user.id, QueryType.vector, payload.case_text, None,
            payload.top_k, payload.embedding_type, None, None,
            latency, QueryStatus.success,
        )
        return SearchResponse(cases=cases, latency_ms=latency)
    except Exception as exc:
        log_query(
            db, user.id, QueryType.vector, payload.case_text, None,
            payload.top_k, payload.embedding_type, None, None,
            None, QueryStatus.error, str(exc),
        )
        raise HTTPException(status_code=502, detail=f"Vector search failed: {exc}") from exc


@router.post("/search/hybrid", response_model=SearchResponse)
def hybrid_search(
    payload: HybridSearchRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        cases, latency = rag_service.rrf_search(
            payload.query_text, payload.keyword_search, payload.top_n,
            payload.embedding_type, payload.vector_weight, payload.keyword_weight, payload.rrf_k,
        )
        log_query(
            db, user.id, QueryType.hybrid, payload.query_text, payload.keyword_search,
            payload.top_n, payload.embedding_type, payload.vector_weight, payload.keyword_weight,
            latency, QueryStatus.success,
        )
        return SearchResponse(cases=cases, latency_ms=latency)
    except Exception as exc:
        log_query(
            db, user.id, QueryType.hybrid, payload.query_text, payload.keyword_search,
            payload.top_n, payload.embedding_type, payload.vector_weight, payload.keyword_weight,
            None, QueryStatus.error, str(exc),
        )
        raise HTTPException(status_code=502, detail=f"Hybrid search failed: {exc}") from exc


@router.get("/config", response_model=list[RagConfigItem])
def get_rag_config(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [RagConfigItem(key=k, value=_get_config_value(db, k)) for k in DEFAULT_CONFIG_KEYS]


@router.put("/config", response_model=list[RagConfigItem])
def update_rag_config(
    payload: RagConfigUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_admin),
):

    updates = {
        "top_n": payload.top_n,
        "embedding_type": payload.embedding_type,
        "vector_weight": payload.vector_weight,
        "keyword_weight": payload.keyword_weight,
        "rrf_k": payload.rrf_k,
    }
    for key, val in updates.items():
        if val is None:
            continue
        row = db.query(RagConfig).filter(RagConfig.key == key).first()
        str_val = str(val)
        if row:
            row.value = str_val
            row.updated_by = user.id
        else:
            db.add(RagConfig(key=key, value=str_val, updated_by=user.id))
    db.commit()
    return [RagConfigItem(key=k, value=_get_config_value(db, k)) for k in DEFAULT_CONFIG_KEYS]
