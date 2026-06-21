-- =============================================================================
-- 009_usp_rag_search.sql
-- Lab 7 — Full RAG pipeline stored procedure
-- Prerequisites: 008, GPT-4o deployed in Azure OpenAI
-- =============================================================================
-- Update @url and @credential below with your Azure OpenAI chat endpoint
-- and database scoped credential name before first run.

CREATE OR ALTER PROCEDURE dbo.usp_ClearPath_RAG_Search
    @PatientDescription NVARCHAR(4000),
    @KeywordSearch      NVARCHAR(4000),
    @TopN               INT          = 5,
    @EmbeddingType      NVARCHAR(50) = N'FullCase',
    @VectorWeight       FLOAT        = 0.6,
    @KeywordWeight      FLOAT        = 0.4,
    @RRF_K              INT          = 60
AS
BEGIN
    SET NOCOUNT ON;

    CREATE TABLE #SimilarCases (
        CaseID          INT,
        PatientAge      INT,
        Gender          NVARCHAR(10),
        ChiefComplaint  NVARCHAR(1000),
        Diagnosis       NVARCHAR(500),
        Severity        NVARCHAR(100),
        TreatmentPlan   NVARCHAR(1000),
        VectorDistance  FLOAT,
        KeywordScore    INT,
        HybridScore     FLOAT
    );

    INSERT INTO #SimilarCases
    EXEC dbo.usp_RRFSearchClinicalCases
        @QueryText      = @PatientDescription,
        @KeywordSearch  = @KeywordSearch,
        @TopN           = @TopN,
        @EmbeddingType  = @EmbeddingType,
        @VectorWeight   = @VectorWeight,
        @KeywordWeight  = @KeywordWeight,
        @RRF_K          = @RRF_K;

    DECLARE @CasesContext NVARCHAR(MAX) = '';

    SELECT @CasesContext = @CasesContext +
        'Case ' + CAST(ROW_NUMBER() OVER (ORDER BY HybridScore DESC) AS NVARCHAR(10)) + ':' + CHAR(13) +
        '  Age: ' + CAST(PatientAge AS NVARCHAR(10)) + CHAR(13) +
        '  Gender: ' + ISNULL(Gender, 'Unknown') + CHAR(13) +
        '  Chief Complaint: ' + ISNULL(ChiefComplaint, 'N/A') + CHAR(13) +
        '  Diagnosis: ' + ISNULL(Diagnosis, 'N/A') + CHAR(13) +
        '  Severity: ' + ISNULL(Severity, 'N/A') + CHAR(13) +
        '  Treatment Plan: ' + ISNULL(TreatmentPlan, 'N/A') + CHAR(13) +
        '  Hybrid Score: ' + CAST(ROUND(HybridScore, 4) AS NVARCHAR(20)) + CHAR(13) + CHAR(13)
    FROM #SimilarCases
    ORDER BY HybridScore DESC;

    DECLARE @SystemPrompt NVARCHAR(MAX) =
        'You are a clinical decision support assistant for the ClearPath system. ' +
        'Based on the similar cases retrieved from the database, provide a concise ' +
        'clinical summary and suggest possible diagnostic pathways for the new patient. ' +
        'Do not make a definitive diagnosis. Always recommend physician review.';

    DECLARE @UserPrompt NVARCHAR(MAX) =
        'New Patient Description: ' + @PatientDescription + CHAR(13) + CHAR(13) +
        'Similar Cases Retrieved from ClearPath Database: ' + CHAR(13) +
        @CasesContext +
        'Based on these similar cases, provide a clinical summary and ' +
        'suggested next steps for the clinician to consider.';

    DECLARE @Payload NVARCHAR(MAX);
    SET @Payload = JSON_OBJECT(
        'messages': JSON_ARRAY(
            JSON_OBJECT('role': 'system', 'content': @SystemPrompt),
            JSON_OBJECT('role': 'user', 'content': @UserPrompt)
        ),
        'max_tokens': 1000,
        'temperature': 0.3
    );

    DECLARE @Response NVARCHAR(MAX);

    EXEC sp_invoke_external_rest_endpoint
        @url        = 'https://your-resource.openai.azure.com/openai/deployments/gpt-4o/chat/completions?api-version=2025-01-01-preview',
        @method     = 'POST',
        @credential = [https://your-resource.openai.azure.com],
        @payload    = @Payload,
        @response   = @Response OUTPUT;

    DECLARE @ClinicalSummary NVARCHAR(MAX);
    SET @ClinicalSummary = JSON_VALUE(@Response, '$.result.choices[0].message.content');

    SELECT
        CaseID, PatientAge, Gender, ChiefComplaint, Diagnosis,
        Severity, TreatmentPlan, VectorDistance, KeywordScore,
        ROUND(HybridScore, 4) AS HybridScore
    FROM #SimilarCases
    ORDER BY HybridScore DESC;

    SELECT @ClinicalSummary AS ClinicalSummary;

    DROP TABLE #SimilarCases;
END;
GO

PRINT 'usp_ClearPath_RAG_Search ready.';
GO
