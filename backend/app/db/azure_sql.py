import contextlib
from typing import Generator

import pyodbc

from app.core.config import settings

# ---------------------------------------------------------------------------
# Connection helpers for the *clinical* data store.
#
# Despite the historical name, the pyodbc connection below is identical for
# **local SQL Server** and **Azure SQL** — only the connection-string fields
# (``sql_server``, ``sql_username`` …) change.  ``AI_PROVIDER`` does NOT
# affect this connection.
# ---------------------------------------------------------------------------


@contextlib.contextmanager
def get_azure_sql_connection() -> Generator[pyodbc.Connection, None, None]:
    """Open a pyodbc connection to the clinical database (local or Azure SQL).

    Kept under its historical name so every existing call site continues to work.
    Use :func:`get_clinical_connection` in new code — it has the same semantics.
    """
    if not settings.sql_server or not settings.sql_username:
        raise RuntimeError(
            "Clinical SQL Server credentials are not configured. "
            "Set SQL_SERVER / SQL_USERNAME / SQL_PASSWORD in your .env file."
        )
    conn = pyodbc.connect(settings.sql_connection_string, timeout=30)
    try:
        yield conn
    finally:
        conn.close()


# New code should use this name — semantically clearer and provider-agnostic.
get_clinical_connection = get_azure_sql_connection


def check_azure_sql_connection() -> bool:
    """Health-check used by the ``/health`` endpoint and the dashboard.

    Kept under its historical name for backward-compat with the analytics
    service and the existing tests.
    """
    try:
        with get_azure_sql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return True
    except Exception:
        return False
