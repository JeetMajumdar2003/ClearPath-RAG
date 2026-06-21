"""Inspect the current state of the RAG stored procedures in Azure SQL."""
import pyodbc
from app.core.config import settings

conn = pyodbc.connect(settings.sql_connection_string, timeout=15)
cur = conn.cursor()

# Check RRF SP
cur.execute("SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.usp_RRFSearchClinicalCases'))")
rrf = cur.fetchone()[0]
print("=" * 70)
print("usp_RRFSearchClinicalCases length:", len(rrf) if rrf else 0)
print("=" * 70)
if rrf:
    print(rrf)

print()
print("=" * 70)
cur.execute("SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.usp_ClearPath_RAG_Search'))")
rag = cur.fetchone()[0]
print("usp_ClearPath_RAG_Search length:", len(rag) if rag else 0)
print("=" * 70)
if rag:
    print(rag)