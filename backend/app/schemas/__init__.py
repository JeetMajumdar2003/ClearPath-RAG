from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.models import QueryStatus, QueryType, UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class RagQueryRequest(BaseModel):
    patient_description: str = Field(min_length=10)
    keyword_search: str = Field(min_length=3)
    top_n: int = Field(default=5, ge=1, le=100)
    embedding_type: str = "FullCase"
    vector_weight: float = Field(default=0.6, ge=0, le=1)
    keyword_weight: float = Field(default=0.4, ge=0, le=1)
    rrf_k: int = Field(default=60, ge=1)


class VectorSearchRequest(BaseModel):
    case_text: str = Field(min_length=10)
    top_k: int = Field(default=5, ge=1, le=100)
    embedding_type: str = "FullCase"


class HybridSearchRequest(BaseModel):
    query_text: str = Field(min_length=10)
    keyword_search: str = Field(min_length=3)
    top_n: int = Field(default=10, ge=1, le=100)
    embedding_type: str = "FullCase"
    vector_weight: float = Field(default=0.6, ge=0, le=1)
    keyword_weight: float = Field(default=0.4, ge=0, le=1)
    rrf_k: int = Field(default=60, ge=1)


class ClinicalCaseResult(BaseModel):
    case_id: int
    patient_age: int | None = None
    gender: str | None = None
    chief_complaint: str | None = None
    diagnosis: str | None = None
    severity: str | None = None
    treatment_plan: str | None = None
    similarity: float | None = None
    vector_distance: float | None = None
    keyword_score: float | None = None
    hybrid_score: float | None = None


class RagQueryResponse(BaseModel):
    cases: list[ClinicalCaseResult]
    clinical_summary: str | None
    latency_ms: int


class SearchResponse(BaseModel):
    cases: list[ClinicalCaseResult]
    latency_ms: int


class QueryLogResponse(BaseModel):
    id: int
    user_id: int
    user_email: str | None = None
    query_type: QueryType
    patient_description: str | None
    keyword_search: str | None
    top_n: int | None
    embedding_type: str | None
    vector_weight: float | None
    keyword_weight: float | None
    latency_ms: int | None
    status: QueryStatus
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedLogs(BaseModel):
    items: list[QueryLogResponse]
    total: int
    page: int
    page_size: int


class DashboardOverview(BaseModel):
    queries_today: int
    total_queries: int
    avg_latency_ms: float
    success_rate: float
    clinical_case_count: int | None
    azure_sql_connected: bool


class UsageDataPoint(BaseModel):
    date: str
    count: int
    query_type: str | None = None


class AnalyticsUsage(BaseModel):
    daily: list[UsageDataPoint]
    by_type: list[UsageDataPoint]


class AnalyticsPerformance(BaseModel):
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    error_count: int
    success_count: int


class RagConfigItem(BaseModel):
    key: str
    value: str


class RagConfigUpdate(BaseModel):
    top_n: int | None = Field(default=None, ge=1, le=100)
    embedding_type: str | None = None
    vector_weight: float | None = Field(default=None, ge=0, le=1)
    keyword_weight: float | None = Field(default=None, ge=0, le=1)
    rrf_k: int | None = Field(default=None, ge=1)


class HealthResponse(BaseModel):
    status: str
    azure_sql_connected: bool
