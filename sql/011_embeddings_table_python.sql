-- =============================================================================
-- 011_embeddings_table_python.sql
-- Python-driven embeddings storage (replaces 005, 006, 007-009).
--
-- Use this script when AI_PROVIDER is ``openrouter`` or ``azure_python``.
-- The Python pipeline writes embeddings here as JSON arrays of floats
-- (NVARCHAR(MAX)), so the table works on every SQL Server 2017+ edition —
-- no VECTOR(1536) type, no Azure SQL 2025 required.
--
-- After running this script, populate the table from the backend with::
--
--     cd backend
--     .venv\Scripts\Activate.ps1
--     python -m app.scripts.generate_embeddings
-- =============================================================================
DROP TABLE dbo.ClinicalCaseEmbeddings
IF OBJECT_ID('dbo.ClinicalCaseEmbeddings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClinicalCaseEmbeddings (
        CaseID          INT             NOT NULL,
        EmbeddingType   NVARCHAR(50)    NOT NULL,
        EmbeddingJson   NVARCHAR(MAX)   NOT NULL,   -- JSON array of floats
        EmbeddingModel  NVARCHAR(200)   NOT NULL,   -- e.g. "nvidia/llama-nemotron-embed-vl-1b-v2:free"
        Dimensions      INT             NOT NULL,   -- 1536 for the default OpenRouter embedding model
        CreatedAt       DATETIME2       NOT NULL CONSTRAINT DF_ClinicalCaseEmbeddings_Created DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2       NOT NULL CONSTRAINT DF_ClinicalCaseEmbeddings_Updated DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_ClinicalCaseEmbeddings PRIMARY KEY CLUSTERED (CaseID, EmbeddingType),
        CONSTRAINT FK_ClinicalCaseEmbeddings_Cases
            FOREIGN KEY (CaseID) REFERENCES dbo.ClinicalCases (CaseID)
            ON DELETE CASCADE
    );
    PRINT 'ClinicalCaseEmbeddings (Python JSON) table created.';
END;
ELSE
BEGIN
    PRINT 'ClinicalCaseEmbeddings already exists — leaving unchanged.';
END;
GO

-- Optional sanity check: how many embeddings are currently stored?
SELECT EmbeddingType, COUNT(*) AS rows, MAX(Dimensions) AS dims
FROM dbo.ClinicalCaseEmbeddings
GROUP BY EmbeddingType;
GO
