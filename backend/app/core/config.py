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

    sql_server: str = ""
    sql_database: str = "ProjectClearPath"
    sql_username: str = ""
    sql_password: str = ""
    sql_driver: str = "ODBC Driver 18 for SQL Server"
    sql_encrypt: str = "yes"
    sql_trust_server_certificate: str = "no"

    search_default_top_n: int = 5
    rrf_vector_weight: float = 0.6
    rrf_keyword_weight: float = 0.4
    rrf_k: int = 60
    embedding_type_default: str = "FullCase"

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


settings = Settings()
