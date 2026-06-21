from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import QueryLog, QueryStatus, QueryType, User
from app.schemas import AnalyticsPerformance, AnalyticsUsage, DashboardOverview, UsageDataPoint
from app.services.rag_service import get_clinical_case_count
from app.db.azure_sql import check_azure_sql_connection


def log_query(
    db: Session,
    user_id: int,
    query_type: QueryType,
    patient_description: str | None,
    keyword_search: str | None,
    top_n: int | None,
    embedding_type: str | None,
    vector_weight: float | None,
    keyword_weight: float | None,
    latency_ms: int | None,
    status: QueryStatus,
    error_message: str | None = None,
) -> QueryLog:
    entry = QueryLog(
        user_id=user_id,
        query_type=query_type,
        patient_description=patient_description,
        keyword_search=keyword_search,
        top_n=top_n,
        embedding_type=embedding_type,
        vector_weight=vector_weight,
        keyword_weight=keyword_weight,
        latency_ms=latency_ms,
        status=status,
        error_message=error_message,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_dashboard_overview(db: Session) -> DashboardOverview:
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_queries = db.query(func.count(QueryLog.id)).scalar() or 0
    queries_today = (
        db.query(func.count(QueryLog.id)).filter(QueryLog.created_at >= today_start).scalar() or 0
    )
    avg_latency = db.query(func.avg(QueryLog.latency_ms)).filter(QueryLog.latency_ms.isnot(None)).scalar()
    success_count = (
        db.query(func.count(QueryLog.id)).filter(QueryLog.status == QueryStatus.success).scalar() or 0
    )
    success_rate = (success_count / total_queries * 100) if total_queries > 0 else 100.0

    return DashboardOverview(
        queries_today=queries_today,
        total_queries=total_queries,
        avg_latency_ms=round(float(avg_latency or 0), 1),
        success_rate=round(success_rate, 1),
        clinical_case_count=get_clinical_case_count(),
        azure_sql_connected=check_azure_sql_connection(),
    )


def get_usage_analytics(db: Session, days: int = 30) -> AnalyticsUsage:
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        db.query(func.date(QueryLog.created_at).label("d"), func.count(QueryLog.id))
        .filter(QueryLog.created_at >= since)
        .group_by(func.date(QueryLog.created_at))
        .order_by(func.date(QueryLog.created_at))
        .all()
    )
    daily = [UsageDataPoint(date=str(r[0]), count=r[1]) for r in rows]

    type_rows = (
        db.query(QueryLog.query_type, func.count(QueryLog.id))
        .filter(QueryLog.created_at >= since)
        .group_by(QueryLog.query_type)
        .all()
    )
    by_type = [UsageDataPoint(date="", count=r[1], query_type=r[0].value) for r in type_rows]

    return AnalyticsUsage(daily=daily, by_type=by_type)


def get_performance_analytics(db: Session, days: int = 30) -> AnalyticsPerformance:
    since = datetime.now(timezone.utc) - timedelta(days=days)
    base = db.query(QueryLog).filter(QueryLog.created_at >= since, QueryLog.latency_ms.isnot(None))

    latencies = [r.latency_ms for r in base.all() if r.latency_ms is not None]
    latencies.sort()

    def percentile(values: list[int], p: float) -> float:
        if not values:
            return 0.0
        idx = int(len(values) * p)
        idx = min(idx, len(values) - 1)
        return float(values[idx])

    success_count = (
        db.query(func.count(QueryLog.id))
        .filter(QueryLog.created_at >= since, QueryLog.status == QueryStatus.success)
        .scalar()
        or 0
    )
    error_count = (
        db.query(func.count(QueryLog.id))
        .filter(QueryLog.created_at >= since, QueryLog.status == QueryStatus.error)
        .scalar()
        or 0
    )

    return AnalyticsPerformance(
        avg_latency_ms=round(sum(latencies) / len(latencies), 1) if latencies else 0.0,
        p50_latency_ms=percentile(latencies, 0.5),
        p95_latency_ms=percentile(latencies, 0.95),
        error_count=error_count,
        success_count=success_count,
    )
