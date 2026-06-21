-- =============================================================================
-- 001_schema_clinical_cases.sql
-- Project ClearPath — ClinicalCases table schema and data insertions
-- Run against: ProjectClearPath database on Azure SQL
-- =============================================================================

IF OBJECT_ID('dbo.ClinicalCases', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ClinicalCases (
        CaseID          INT IDENTITY(1,1) NOT NULL,
        PatientAge      INT NOT NULL,
        Gender          NVARCHAR(10) NOT NULL,
        ChiefComplaint  NVARCHAR(500) NOT NULL,
        Symptoms        NVARCHAR(MAX) NOT NULL,
        MedicalHistory  NVARCHAR(MAX) NULL,
        Diagnosis       NVARCHAR(500) NOT NULL,
        TreatmentPlan   NVARCHAR(MAX) NOT NULL,
        Outcome         NVARCHAR(MAX) NULL,
        Severity        NVARCHAR(50) NOT NULL,
        LengthOfStay    INT NULL,
        CostOfCare      DECIMAL(12, 2) NULL,
        CreatedDate     DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedDate     DATETIME2 NULL,
        CONSTRAINT PK_ClinicalCases PRIMARY KEY CLUSTERED (CaseID)
    );
END;
GO

PRINT 'ClinicalCases table ready.';
GO

-- Insert sample data into ClinicalCases table (csv_file_path: data\ClinicalCases.csv)
BULK INSERT dbo.ClinicalCases
FROM 'C:\Path\To\Your\Data\ClinicalCases.csv'
WITH (
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FIRSTROW = 1
);