import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    clinician = "clinician"


class QueryType(str, enum.Enum):
    rag = "rag"
    vector = "vector"
    hybrid = "hybrid"


class QueryStatus(str, enum.Enum):
    success = "success"
    error = "error"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.clinician, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    query_logs: Mapped[list["QueryLog"]] = relationship(back_populates="user")


class QueryLog(Base):
    __tablename__ = "query_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    query_type: Mapped[QueryType] = mapped_column(Enum(QueryType), nullable=False)
    patient_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    keyword_search: Mapped[str | None] = mapped_column(Text, nullable=True)
    top_n: Mapped[int | None] = mapped_column(Integer, nullable=True)
    embedding_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    vector_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    keyword_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[QueryStatus] = mapped_column(Enum(QueryStatus), nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    user: Mapped["User"] = relationship(back_populates="query_logs")


class RagConfig(Base):
    __tablename__ = "rag_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[str] = mapped_column(String(500), nullable=False)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
