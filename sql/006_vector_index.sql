-- =============================================================================
-- 006_vector_index.sql
-- Lab 4/5 — Cosine vector index on ClinicalCaseEmbeddings
-- Prerequisites: 005_embeddings_table_and_generation.sql
-- =============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.vector_indexes vi
    INNER JOIN sys.objects o ON vi.object_id = o.object_id
    WHERE o.name = 'ClinicalCaseEmbeddings'
)
BEGIN
    CREATE VECTOR INDEX clinical_case_vector_index
    ON dbo.ClinicalCaseEmbeddings (CaseEmbedding)
    WITH (METRIC = 'cosine');
END;
GO

PRINT 'Vector index ready.';
GO
