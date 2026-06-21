"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.Enum("admin", "clinician", name="userrole"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)

    op.create_table(
        "query_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("query_type", sa.Enum("rag", "vector", "hybrid", name="querytype"), nullable=False),
        sa.Column("patient_description", sa.Text(), nullable=True),
        sa.Column("keyword_search", sa.Text(), nullable=True),
        sa.Column("top_n", sa.Integer(), nullable=True),
        sa.Column("embedding_type", sa.String(length=50), nullable=True),
        sa.Column("vector_weight", sa.Float(), nullable=True),
        sa.Column("keyword_weight", sa.Float(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("status", sa.Enum("success", "error", name="querystatus"), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_query_logs_created_at"), "query_logs", ["created_at"], unique=False)
    op.create_index(op.f("ix_query_logs_id"), "query_logs", ["id"], unique=False)
    op.create_index(op.f("ix_query_logs_user_id"), "query_logs", ["user_id"], unique=False)

    op.create_table(
        "rag_config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=100), nullable=False),
        sa.Column("value", sa.String(length=500), nullable=False),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )


def downgrade() -> None:
    op.drop_table("rag_config")
    op.drop_table("query_logs")
    op.drop_table("users")
    op.execute("DROP TYPE IF EXISTS querystatus")
    op.execute("DROP TYPE IF EXISTS querytype")
    op.execute("DROP TYPE IF EXISTS userrole")
