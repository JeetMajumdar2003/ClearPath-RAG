from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1 import api_router
from app.api.v1.rag import limiter
from app.core.config import settings
from app.db.azure_sql import check_azure_sql_connection
from app.schemas import HealthResponse

app = FastAPI(title=settings.app_name, version="1.0.0")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health():
    connected = check_azure_sql_connection()
    return HealthResponse(
        status="ok" if connected else "degraded",
        azure_sql_connected=connected,
    )
