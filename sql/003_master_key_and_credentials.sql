-- =============================================================================
-- 003_master_key_and_credentials.sql
-- Lab 3 — Master key and database scoped credential for Azure OpenAI
-- Prerequisites: Azure OpenAI resource with Managed Identity RBAC configured
-- =============================================================================
-- @SQL_MASTER_KEY_PASSWORD — replace with your master key password
-- @DB_SCOPED_CREDENTIAL_NAME — e.g. https://your-resource.openai.azure.com

IF NOT EXISTS (SELECT 1 FROM sys.symmetric_keys WHERE name = '##MS_DatabaseMasterKey##')
BEGIN
    CREATE MASTER KEY ENCRYPTION BY PASSWORD = N'AzureSQLAI2026';
END;
GO

-- Replace credential name with your Azure OpenAI endpoint URL (no trailing slash)
IF NOT EXISTS (
    SELECT 1 FROM sys.database_scoped_credentials
    WHERE name = 'https://your-resource.openai.azure.com'
)
BEGIN
    CREATE DATABASE SCOPED CREDENTIAL [https://your-resource.openai.azure.com]
    WITH IDENTITY = 'Managed Identity',
    SECRET = '{"resourceid":"https://cognitiveservices.azure.com"}';
END;
GO

SELECT name, credential_identity, create_date
FROM sys.database_scoped_credentials;
GO

PRINT 'Master key and database scoped credential ready.';
GO
