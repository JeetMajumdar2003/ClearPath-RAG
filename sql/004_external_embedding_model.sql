-- =============================================================================
-- 004_external_embedding_model.sql
-- Lab 3 — External embedding model (text-embedding-3-small)
-- Prerequisites: 003_master_key_and_credentials.sql
-- =============================================================================
-- @EMBEDDING_TARGET_URI — e.g.
-- https://{resource}.openai.azure.com/openai/deployments/text-embedding-3-small/embeddings?api-version=2023-05-15
-- @DB_SCOPED_CREDENTIAL_NAME — must match credential from 003

IF NOT EXISTS (SELECT 1 FROM sys.external_models WHERE name = 'embedding_openai_text3_small')
BEGIN
    CREATE EXTERNAL MODEL [embedding_openai_text3_small]
    WITH (
        LOCATION = 'https://your-resource.openai.azure.com/openai/deployments/text-embedding-3-small/embeddings?api-version=2023-05-15',
        API_FORMAT = 'Azure OpenAI',
        MODEL_TYPE = EMBEDDINGS,
        MODEL = 'text-embedding-3-small',
        CREDENTIAL = [https://your-resource.openai.azure.com]
    );
END;
GO

SELECT name, model_type, model, location FROM sys.external_models;
GO

PRINT 'External embedding model ready.';
GO
