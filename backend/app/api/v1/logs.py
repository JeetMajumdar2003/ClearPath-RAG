from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import QueryLog, QueryStatus, QueryType
from app.schemas import PaginatedLogs, QueryLogResponse

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("", response_model=PaginatedLogs)
def list_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: QueryStatus | None = None,
    query_type: QueryType | None = None,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    q = db.query(QueryLog).options(joinedload(QueryLog.user))
    if status:
        q = q.filter(QueryLog.status == status)
    if query_type:
        q = q.filter(QueryLog.query_type == query_type)

    total = q.count()
    rows = q.order_by(QueryLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = [
        QueryLogResponse(
            id=r.id,
            user_id=r.user_id,
            user_email=r.user.email if r.user else None,
            query_type=r.query_type,
            patient_description=r.patient_description,
            keyword_search=r.keyword_search,
            top_n=r.top_n,
            embedding_type=r.embedding_type,
            vector_weight=r.vector_weight,
            keyword_weight=r.keyword_weight,
            latency_ms=r.latency_ms,
            status=r.status,
            error_message=r.error_message,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return PaginatedLogs(items=items, total=total, page=page, page_size=page_size)
