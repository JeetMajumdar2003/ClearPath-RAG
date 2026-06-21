-- =============================================================================
-- 007_usp_find_similar_cases.sql
-- Lab 5 — Vector similarity search stored procedure
-- Prerequisites: 005, 006
-- =============================================================================

CREATE OR ALTER PROCEDURE [dbo].[usp_FindSimilarClinicalCases]
(
    @CaseText       NVARCHAR(MAX),
    @TopK           INT = 5,
    @EmbeddingType  NVARCHAR(50) = N'FullCase'
)
AS
BEGIN
    SET NOCOUNT ON;

    IF @CaseText IS NULL OR LTRIM(RTRIM(@CaseText)) = N''
        THROW 50001, 'CaseText cannot be NULL or empty.', 1;

    IF @TopK IS NULL OR @TopK < 1 OR @TopK > 100
        THROW 50002, 'TopK must be between 1 and 100.', 1;

    DECLARE @query_vector VECTOR(1536);

    SET @query_vector = AI_GENERATE_EMBEDDINGS(
        @CaseText
        USE MODEL [embedding_openai_text3_small]
    );

    SELECT TOP (@TopK) WITH APPROXIMATE
        c.CaseID,
        c.PatientAge,
        c.Gender,
        c.ChiefComplaint,
        c.Diagnosis,
        c.Severity,
        c.TreatmentPlan,
        1 - s.distance AS Similarity
    FROM VECTOR_SEARCH(
        TABLE = dbo.ClinicalCaseEmbeddings AS t,
        COLUMN = CaseEmbedding,
        SIMILAR_TO = @query_vector,
        METRIC = 'cosine'
    ) AS s
    INNER JOIN dbo.ClinicalCases c ON t.CaseID = c.CaseID
    WHERE t.EmbeddingType = @EmbeddingType
    ORDER BY s.distance ASC;
END;
GO

PRINT 'usp_FindSimilarClinicalCases ready.';
GO
