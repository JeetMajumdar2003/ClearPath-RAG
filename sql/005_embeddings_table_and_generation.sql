-- =============================================================================
-- 005_embeddings_table_and_generation.sql
-- Lab 4 — ClinicalCaseEmbeddings table and AI_GENERATE_EMBEDDINGS batch jobs
-- Prerequisites: 001, 004
-- =============================================================================

IF OBJECT_ID('dbo.ClinicalCaseEmbeddings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClinicalCaseEmbeddings (
        EmbeddingID     INT IDENTITY(1,1) PRIMARY KEY,
        CaseID          INT NOT NULL,
        EmbeddingType   NVARCHAR(50) NOT NULL
            CONSTRAINT CHK_EmbeddingType CHECK (
                EmbeddingType IN ('FullCase', 'SymptomsOnly', 'DiagnosisOnly', 'TreatmentOnly', 'OutcomeOnly')
            ),
        CaseEmbedding   VECTOR(1536) NOT NULL,
        ModelUsed       NVARCHAR(100) NOT NULL DEFAULT 'text-embedding-3-small',
        CreatedDate     DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_ClinicalCaseEmbeddings_ClinicalCases
            FOREIGN KEY (CaseID) REFERENCES dbo.ClinicalCases(CaseID) ON DELETE CASCADE,
        CONSTRAINT UQ_CaseID_EmbeddingType UNIQUE (CaseID, EmbeddingType),
        INDEX IX_ClinicalCaseEmbeddings_CaseID (CaseID),
        INDEX IX_ClinicalCaseEmbeddings_EmbeddingType (EmbeddingType)
    );
END;
GO

-- Generate FullCase embeddings (idempotent)
INSERT INTO dbo.ClinicalCaseEmbeddings (CaseID, EmbeddingType, CaseEmbedding, ModelUsed)
SELECT
    c.CaseID,
    'FullCase' AS EmbeddingType,
    AI_GENERATE_EMBEDDINGS(
        CONCAT(
            'Patient: ', c.PatientAge, ' year old ', c.Gender, '. ',
            'Chief Complaint: ', c.ChiefComplaint, '. ',
            'Symptoms: ', c.Symptoms, '. ',
            'Medical History: ', c.MedicalHistory, '. ',
            'Diagnosis: ', c.Diagnosis, '. ',
            'Treatment: ', c.TreatmentPlan, '. ',
            'Outcome: ', c.Outcome
        )
        USE MODEL [embedding_openai_text3_small]
    ) AS CaseEmbedding,
    'text-embedding-3-small' AS ModelUsed
FROM dbo.ClinicalCases c
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.ClinicalCaseEmbeddings e
    WHERE e.CaseID = c.CaseID AND e.EmbeddingType = 'FullCase'
);
GO

-- Generate SymptomsOnly embeddings (idempotent)
INSERT INTO dbo.ClinicalCaseEmbeddings (CaseID, EmbeddingType, CaseEmbedding, ModelUsed)
SELECT
    c.CaseID,
    'SymptomsOnly' AS EmbeddingType,
    AI_GENERATE_EMBEDDINGS(
        CONCAT('Chief Complaint: ', c.ChiefComplaint, '. ', 'Symptoms: ', c.Symptoms)
        USE MODEL [embedding_openai_text3_small]
    ) AS CaseEmbedding,
    'text-embedding-3-small' AS ModelUsed
FROM dbo.ClinicalCases c
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.ClinicalCaseEmbeddings e
    WHERE e.CaseID = c.CaseID AND e.EmbeddingType = 'SymptomsOnly'
);
GO

SELECT
    EmbeddingType,
    COUNT(*) AS TotalEmbeddings,
    COUNT(DISTINCT CaseID) AS UniqueCases
FROM dbo.ClinicalCaseEmbeddings
GROUP BY EmbeddingType;
GO

PRINT 'Embeddings table populated.';
GO
