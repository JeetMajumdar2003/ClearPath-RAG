from pathlib import Path
from urllib.parse import quote_plus

from pydantic_settings import BaseSettings, SettingsConfigDict

# Project root holds the .env (two levels up from backend/app/core/).
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_ENV_FILE = _PROJECT_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "ClearPath RAG"
    app_env: str = "development"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 1440
    cors_origins: str = "http://localhost:5173"

    postgres_host: str = "postgres"
    postgres_port: int = 5432
    postgres_db: str = "clearpath_app"
    postgres_user: str = "clearpath"
    postgres_password: str = "clearpath_dev_password"

    # Clinical data store — works for BOTH local SQL Server and Azure SQL.
    # The pyodbc connection is identical, only the address/credentials differ.
    sql_server: str = ""
    sql_database: str = "ProjectClearPath"
    sql_username: str = ""
    sql_password: str = ""
    sql_driver: str = "ODBC Driver 18 for SQL Server"
    sql_encrypt: str = "yes"
    sql_trust_server_certificate: str = "no"

    # Table names (overridable via .env if you use a different schema layout).
    clinical_cases_table: str = "dbo.ClinicalCases"
    clinical_cases_primary_key: str = "PK_ClinicalCases"
    embeddings_table: str = "dbo.ClinicalCaseEmbeddings"
    fulltext_catalog_name: str = "ClinicalCasesFTCatalog"

    # ------------------------------------------------------------------ AI provider
    # ``openrouter``    — Python pipeline, OpenRouter REST API (free chat models)
    # ``azure_python``  — Python pipeline, Azure OpenAI REST API
    # ``azure``         — legacy mode: Azure SQL stored procedures do everything
    ai_provider: str = "openrouter"

    # ----- OpenRouter -----------------------------------------------------------
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_embed_model: str = "nvidia/llama-nemotron-embed-vl-1b-v2:free"
    openrouter_chat_model: str = "nvidia/nemotron-3-super-120b-a12b:free"
    openrouter_embedding_dimensions: int = 2048
    openrouter_app_name: str = "ClearPath RAG"
    openrouter_http_referer: str = "http://localhost:5173"

    # ----- Azure OpenAI (used by ``azure`` and ``azure_python`` modes) ----------
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_api_version_embeddings: str = "2023-05-15"
    azure_openai_api_version_chat: str = "2025-01-01-preview"
    azure_openai_embedding_deployment: str = "text-embedding-3-small"
    azure_openai_chat_deployment: str = "gpt-4o"

    # ----- Shared RAG defaults --------------------------------------------------
    search_default_top_n: int = 5
    rrf_vector_weight: float = 0.6
    rrf_keyword_weight: float = 0.4
    rrf_k: int = 60
    embedding_type_default: str = "FullCase"
    embedding_vector_dimensions: int = 2048

    # ----- Legacy Azure SQL SP names (only used when ``AI_PROVIDER=azure``) -----
    sp_find_similar_cases: str = "dbo.usp_FindSimilarClinicalCases"
    sp_rrf_search: str = "dbo.usp_RRFSearchClinicalCases"
    sp_rag_search: str = "dbo.usp_ClearPath_RAG_Search"

    admin_email: str = "admin@clearpath.local"
    admin_password: str = "Admin123!"
    admin_full_name: str = "ClearPath Admin"

    @property
    def postgres_url(self) -> str:
        user = quote_plus(self.postgres_user)
        password = quote_plus(self.postgres_password)
        return (
            f"postgresql+psycopg2://{user}:{password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sql_connection_string(self) -> str:
        return (
            f"DRIVER={{{self.sql_driver}}};"
            f"SERVER={self.sql_server};"
            f"DATABASE={self.sql_database};"
            f"UID={self.sql_username};"
            f"PWD={self.sql_password};"
            f"Encrypt={self.sql_encrypt};"
            f"TrustServerCertificate={self.sql_trust_server_certificate};"
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_legacy_azure_sql_mode(self) -> bool:
        """True when the legacy SP-driven Azure SQL path is active."""
        return self.ai_provider.lower().strip() == "azure"


settings = Settings()
