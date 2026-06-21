-- =============================================================================
-- 010_verification_queries.sql
-- Health checks for ClearPath RAG deployment
-- =============================================================================

PRINT '=== Object Existence ===';

SELECT 'ClinicalCases' AS ObjectName,
    CASE WHEN OBJECT_ID('dbo.ClinicalCases', 'U') IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS Status
UNION ALL
SELECT 'ClinicalCaseEmbeddings',
    CASE WHEN OBJECT_ID('dbo.ClinicalCaseEmbeddings', 'U') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT 'usp_FindSimilarClinicalCases',
    CASE WHEN OBJECT_ID('dbo.usp_FindSimilarClinicalCases', 'P') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT 'usp_RRFSearchClinicalCases',
    CASE WHEN OBJECT_ID('dbo.usp_RRFSearchClinicalCases', 'P') IS NOT NULL THEN 'OK' ELSE 'MISSING' END
UNION ALL
SELECT 'usp_ClearPath_RAG_Search',
    CASE WHEN OBJECT_ID('dbo.usp_ClearPath_RAG_Search', 'P') IS NOT NULL THEN 'OK' ELSE 'MISSING' END;
GO

PRINT '=== Row Counts ===';

SELECT 'ClinicalCases' AS TableName, COUNT(*) AS RowCount FROM dbo.ClinicalCases
UNION ALL
SELECT 'ClinicalCaseEmbeddings', COUNT(*) FROM dbo.ClinicalCaseEmbeddings;
GO

PRINT '=== Embedding Summary ===';

SELECT EmbeddingType, COUNT(*) AS Count
FROM dbo.ClinicalCaseEmbeddings
GROUP BY EmbeddingType;
GO

PRINT '=== External Model ===';

SELECT name, model_type, model FROM sys.external_models;
GO

-- Sample vector search (uncomment to test)
/*
EXEC dbo.usp_FindSimilarClinicalCases
    @CaseText = 'patient presenting with heart attack symptoms',
    @TopK = 3;
*/

-- Sample RAG query (uncomment to test — requires GPT-4o configured in 009)
/*
EXEC dbo.usp_ClearPath_RAG_Search
    @PatientDescription = '58 year old male with chest tightness and shortness of breath',
    @KeywordSearch = '"chest tightness" OR "shortness of breath" OR "chest pain"';
*/
