from fastapi import APIRouter

from app.api.v1 import analytics, auth, dashboard, logs, rag

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(rag.router)
api_router.include_router(dashboard.router)
api_router.include_router(logs.router)
api_router.include_router(analytics.router)
