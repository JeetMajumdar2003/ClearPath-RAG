from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.schemas import AnalyticsPerformance, AnalyticsUsage
from app.services.analytics_service import get_performance_analytics, get_usage_analytics

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/usage", response_model=AnalyticsUsage)
def usage(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return get_usage_analytics(db, days)


@router.get("/performance", response_model=AnalyticsPerformance)
def performance(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return get_performance_analytics(db, days)
