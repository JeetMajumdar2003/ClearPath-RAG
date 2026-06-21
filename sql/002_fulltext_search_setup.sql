-- =============================================================================
-- 002_fulltext_search_setup.sql
-- Lab 1 — Full-text catalog and index on ClinicalCases
-- Prerequisites: 001_schema_clinical_cases.sql
-- =============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.fulltext_catalogs WHERE name = 'ClinicalCasesFTCatalog')
BEGIN
    CREATE FULLTEXT CATALOG ClinicalCasesFTCatalog
    WITH ACCENT_SENSITIVITY = OFF
    AS DEFAULT;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.fulltext_indexes fi
    INNER JOIN sys.objects o ON fi.object_id = o.object_id
    WHERE o.name = 'ClinicalCases'
)
BEGIN
    CREATE FULLTEXT INDEX ON [dbo].[ClinicalCases] (
        [ChiefComplaint] LANGUAGE 1033,
        [Symptoms] LANGUAGE 1033,
        [MedicalHistory] LANGUAGE 1033,
        [Diagnosis] LANGUAGE 1033,
        [TreatmentPlan] LANGUAGE 1033,
        [Outcome] LANGUAGE 1033
    )
    KEY INDEX PK_ClinicalCases
    ON ClinicalCasesFTCatalog
    WITH STOPLIST = SYSTEM, CHANGE_TRACKING AUTO;
END;
GO

PRINT 'Full-text catalog and index ready.';
GO

-- Demo queries (optional — uncomment to test)
/*
SELECT CaseID, ChiefComplaint, Diagnosis
FROM ClinicalCases
WHERE CONTAINS((ChiefComplaint, Symptoms), '"heart attack"');

SELECT CaseID, ChiefComplaint, Diagnosis
FROM ClinicalCases
WHERE FREETEXT((ChiefComplaint, Symptoms), 'patient cannot breathe struggling to get air');
*/
