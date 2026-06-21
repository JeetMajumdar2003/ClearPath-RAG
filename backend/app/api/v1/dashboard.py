from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.schemas import DashboardOverview
from app.services.analytics_service import get_dashboard_overview

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverview)
def overview(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    return get_dashboard_overview(db)
