Based on the Microsoft documentation for SQL Server 2025 (17.x), here's how to use the AI embedding features and enable them in your local installation:

## SQL Server 2025 AI Features Overview

SQL Server 2025 introduces native AI capabilities available in **all editions** (Enterprise, Standard, Express):

1. **Native Vector Data Type** - Store embeddings efficiently
2. **Vector Indexing** - DiskANN-based approximate search
3. **Embedding Generation** - `AI_GENERATE_EMBEDDINGS` function
4. **Text Chunking** - `AI_GENERATE_CHUNKS` function
5. **External Model Support** - Connect to Azure OpenAI, OpenAI, Ollama, or local ONNX models
6. **Vector Functions** - Built-in operations for vectors

## Why You Can't Use `ai_generate` Features Locally

The AI functions require specific configurations to be enabled:

### 1. Preview Features Must Be Enabled
```sql
ALTER DATABASE SCOPED CONFIGURATION
SET PREVIEW_FEATURES = ON;
```

### 2. External REST Endpoint Must Be Enabled
```sql
EXECUTE sp_configure 'external rest endpoint enabled', 1;
RECONFIGURE WITH OVERRIDE;
```

### 3. External AI Runtimes Must Be Enabled (for Local Models)
```sql
EXECUTE sp_configure 'external AI runtimes enabled', 1;
RECONFIGURE WITH OVERRIDE;
```

### 4. You Need to Create an External Model
Before using `AI_GENERATE_EMBEDDINGS`, you must define an external model pointing to your AI service.

## Step-by-Step Setup Guide

### 1. Enable Required Features
```sql
-- Enable preview features (required for SQL Server 2025)
ALTER DATABASE SCOPED CONFIGURATION
SET PREVIEW_FEATURES = ON;

-- Enable external REST endpoint
EXECUTE sp_configure 'external rest endpoint enabled', 1;
RECONFIGURE WITH OVERRIDE;

-- Enable external AI runtimes (if using local models like ONNX)
EXECUTE sp_configure 'external AI runtimes enabled', 1;
RECONFIGURE WITH OVERRIDE;
```

### 2. Create Database Master Key
```sql
IF NOT EXISTS (SELECT * FROM sys.symmetric_keys WHERE [name] = '##MS_DatabaseMasterKey##')
BEGIN
    CREATE MASTER KEY ENCRYPTION BY PASSWORD = N'YourStrong!Passw0rd';
END
```

### 3. Create Credentials for Your AI Service

**For Azure OpenAI:**
```sql
CREATE DATABASE SCOPED CREDENTIAL [https://your-resource.openai.azure.com/]
    WITH IDENTITY = 'HTTPEndpointHeaders',
    SECRET = '{"api-key":"your-azure-openai-key"}';
```

### 4. Create an External Model

**For Azure OpenAI:**
```sql
CREATE EXTERNAL MODEL MyAzureOpenAIModel
WITH (
    LOCATION = 'https://your-resource.openai.azure.com/openai/deployments/text-embedding-ada-002/embeddings?api-version=2023-05-15',
    API_FORMAT = 'Azure OpenAI',
    MODEL_TYPE = EMBEDDINGS,
    MODEL = 'text-embedding-ada-002',
    CREDENTIAL = [https://your-resource.openai.azure.com/]
);
```

**For Local ONNX Model:**
```sql
CREATE EXTERNAL MODEL MyLocalOnnxModel
WITH (
    LOCATION = 'C:\\onnx_runtime\\model\\all-MiniLM-L6-v2-onnx',
    API_FORMAT = 'ONNX Runtime',
    MODEL_TYPE = EMBEDDINGS,
    MODEL = 'allMiniLM',
    PARAMETERS = '{"valid":"JSON"}',
    LOCAL_RUNTIME_PATH = 'C:\\onnx_runtime\\'
);
```

### 5. Set Up ONNX Runtime Environment (for Local Models)
If using local ONNX models:
1. Install ONNX Runtime (version 1.19+)
2. Install tokenizers-cpp library
3. Download your ONNX model (e.g., all-MiniLM-L6-v2)
4. Set proper permissions for MSSQLLaunchpad service account

### 6. Use the AI Functions

**Generate Embeddings:**
```sql
SELECT AI_GENERATE_EMBEDDINGS('Hello world' USE MODEL MyAzureOpenAIModel);
```

**Store Embeddings in Vector Column:**
```sql
CREATE TABLE Documents (
    Id INT IDENTITY PRIMARY KEY,
    Content NVARCHAR(MAX),
    Embedding VECTOR(1536)
);

INSERT INTO Documents (Content, Embedding)
SELECT 'Sample text', 
       AI_GENERATE_EMBEDDINGS('Sample text' USE MODEL MyAzureOpenAIModel);
```

**Vector Similarity Search:**
```sql
SELECT TOP 5 Id, Content
FROM Documents
ORDER BY VECTOR_DISTANCE('cosine', Embedding, 
        AI_GENERATE_EMBEDDINGS('search query' USE MODEL MyAzureOpenAIModel)) ASC;
```

### 7. Create Vector Index for Better Performance
```sql
CREATE VECTOR INDEX ix_Documents_Embedding
ON Documents (Embedding);
```

## Troubleshooting Tips

If getting empty/null results:
1. Verify all required features are enabled
2. Check API key validity and permissions
3. Ensure network connectivity to AI service
4. Confirm model name matches deployed model
5. Enable `ai_generate_embeddings_summary` XEvent for debugging
6. Verify EXECUTE permission on external model

## Key Points for Your Local Setup

- SQL Server 2025 Developer/Express Edition supports all AI features
- No additional licensing required beyond SQL Server installation
- Local ONNX models work offline once configured
- Azure OpenAI requires internet and valid API key
- All features work in Express Edition - no Enterprise/Standard needed

**The issue is likely that preview features and external endpoints weren't enabled.** Run the configuration commands above, and you should be able to use AI features in your local SQL Server 2025 installation.

Would you like specific setup instructions for Azure OpenAI or local ONNX models based on your preference?