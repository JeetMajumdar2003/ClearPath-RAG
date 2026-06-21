-- =============================================================================
-- 008_usp_rrf_hybrid_search.sql
-- Lab 6 — Reciprocal Rank Fusion hybrid search stored procedure
-- Prerequisites: 002, 007
-- =============================================================================

CREATE OR ALTER PROCEDURE dbo.usp_RRFSearchClinicalCases
    @QueryText        NVARCHAR(4000),
    @KeywordSearch    NVARCHAR(4000),
    @TopN             INT           = 10,
    @EmbeddingType    NVARCHAR(50)  = N'FullCase',
    @VectorWeight     FLOAT         = 0.6,
    @KeywordWeight    FLOAT         = 0.4,
    @RRF_K            INT           = 60
AS
BEGIN
    SET NOCOUNT ON;

    IF @QueryText IS NULL OR LTRIM(RTRIM(@QueryText)) = N''
        THROW 50001, 'QueryText cannot be NULL or empty.', 1;

    IF @KeywordSearch IS NULL OR LTRIM(RTRIM(@KeywordSearch)) = N''
        THROW 50002, 'KeywordSearch cannot be NULL or empty.', 1;

    IF @TopN IS NULL OR @TopN < 1 OR @TopN > 100
        THROW 50003, 'TopN must be between 1 and 100.', 1;

    DECLARE @QueryEmbedding VECTOR(1536);
    SET @QueryEmbedding = AI_GENERATE_EMBEDDINGS(
        CAST(@QueryText AS NVARCHAR(4000))
        USE MODEL [embedding_openai_text3_small]
    );

    WITH VectorCandidates AS (
        SELECT TOP (50) WITH APPROXIMATE
            t.CaseID,
            s.distance AS VectorDistance
        FROM VECTOR_SEARCH(
            TABLE = dbo.ClinicalCaseEmbeddings AS t,
            COLUMN = CaseEmbedding,
            SIMILAR_TO = @QueryEmbedding,
            METRIC = 'cosine'
        ) AS s
        WHERE t.EmbeddingType = @EmbeddingType
        ORDER BY s.distance ASC
    ),
    VectorResults AS (
        SELECT
            c.CaseID, c.PatientAge, c.Gender, c.ChiefComplaint,
            c.Diagnosis, c.Severity, c.TreatmentPlan,
            vc.VectorDistance,
            ROW_NUMBER() OVER (ORDER BY vc.VectorDistance ASC) AS VectorRank
        FROM VectorCandidates vc
        INNER JOIN dbo.ClinicalCases c ON vc.CaseID = c.CaseID
    ),
    KeywordResults AS (
        SELECT TOP (50)
            c.CaseID, c.PatientAge, c.Gender, c.ChiefComplaint,
            c.Diagnosis, c.Severity, c.TreatmentPlan,
            ft.[RANK] AS KeywordScore,
            ROW_NUMBER() OVER (ORDER BY ft.[RANK] DESC) AS KeywordRank
        FROM dbo.ClinicalCases c
        INNER JOIN CONTAINSTABLE(
            dbo.ClinicalCases,
            (ChiefComplaint, Symptoms, Diagnosis, TreatmentPlan),
            @KeywordSearch
        ) AS ft ON c.CaseID = ft.[KEY]
    ),
    FusedResults AS (
        SELECT
            COALESCE(v.CaseID, k.CaseID) AS CaseID,
            COALESCE(v.PatientAge, k.PatientAge) AS PatientAge,
            COALESCE(v.Gender, k.Gender) AS Gender,
            COALESCE(v.ChiefComplaint, k.ChiefComplaint) AS ChiefComplaint,
            COALESCE(v.Diagnosis, k.Diagnosis) AS Diagnosis,
            COALESCE(v.Severity, k.Severity) AS Severity,
            COALESCE(v.TreatmentPlan, k.TreatmentPlan) AS TreatmentPlan,
            v.VectorDistance,
            k.KeywordScore,
            (
                COALESCE(@VectorWeight * (1.0 / (@RRF_K + COALESCE(v.VectorRank, 9999))), 0) +
                COALESCE(@KeywordWeight * (1.0 / (@RRF_K + COALESCE(k.KeywordRank, 9999))), 0)
            ) AS HybridScore
        FROM VectorResults v
        FULL OUTER JOIN KeywordResults k ON v.CaseID = k.CaseID
    )
    SELECT TOP (@TopN)
        CaseID, PatientAge, Gender, ChiefComplaint, Diagnosis,
        Severity, TreatmentPlan, VectorDistance, KeywordScore, HybridScore
    FROM FusedResults
    ORDER BY HybridScore DESC;
END;
GO

PRINT 'usp_RRFSearchClinicalCases ready.';
GO
