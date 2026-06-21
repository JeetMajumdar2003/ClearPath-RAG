import contextlib
from typing import Generator

import pyodbc

from app.core.config import settings


@contextlib.contextmanager
def get_azure_sql_connection() -> Generator[pyodbc.Connection, None, None]:
    if not settings.sql_server or not settings.sql_username:
        raise RuntimeError("Azure SQL credentials are not configured")
    conn = pyodbc.connect(settings.sql_connection_string, timeout=30)
    try:
        yield conn
    finally:
        conn.close()


def check_azure_sql_connection() -> bool:
    try:
        with get_azure_sql_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return True
    except Exception:
        return False
