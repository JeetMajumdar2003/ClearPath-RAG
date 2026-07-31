# ClearPath-RAG Architecture Diagram

## Legend
- 🟦 Frontend Components
- 🟪 Backend Components  
- 🟨 Database & Infrastructure
- 🟧 External Services

```mermaid
flowchart TB
    subgraph "CLIENT LAYER"
        direction LR
        A[Frontend - React/TS<br/>Vite @ port 5173]
        B[Backend API - FastAPI<br/>Uvicorn @ port 8000]
    end

    subgraph "FRONTEND ARCHITECTURE"
        A --> A1[App.tsx<br/>React Router]
        A1 --> A2[AuthProvider<br/>ProtectedRoute]
        A1 --> A3[Pages]
        A3 --> A3a[Landing]
        A3 --> A3b[Login/Register]
        A3 --> A3c[Dashboard]
        A3 --> A3d[RAG Console]
        A3 --> A3e[Chat]
        A3 --> A3f[Search Explorer]
        A3 --> A3g[Logs]
        A3 --> A3h[Analytics]
        A3 --> A3i[Settings]
        A --> A4[API Client<br/>Axios w/ JWT]
        A4 -->|Bearer Token| B
    end

    subgraph "BACKEND ARCHITECTURE"
        B --> B1[main.py<br/>App Factory]
        B1 --> B2[API Router v1<br/>/api/v1]
        B1 --> B3[Health Check<br/>/health]
        
        B2 --> B2a[auth.py<br/>JWT Auth Routes]
        B2 --> B2b[rag.py<br/>RAG/Search API]
        B2 --> B2c[logs.py<br/>Query Logs]
        B2 --> B2d[dashboard.py<br/>Overview Data]
        B2 --> B2e[analytics.py<br/>Usage Metrics]
        
        B1 --> B4[Middleware]
        B4 --> B4a[CORS]
        B4 --> B4b[Rate Limiter<br/>slowapi]
        
        B --> B5[Core Layer]
        B5 --> B5a[config.py<br/>Pydantic Settings]
        B5 --> B5b[security.py<br/>JWT/Hash]
        
        B --> B6[Database Layer]
        B6 --> B6a[PostgreSQL<br/>clearpath_app]
        B6 --> B6b[Azure SQL<br/>ProjectClearPath]
        
        B5 --> B7[Services]
        B7 --> B7a[rag_service.py<br/>Vector/RRF/RAG]
        B7 --> B7b[auth_service.py<br/>Auth Logic]
        B7 --> B7c[analytics_service.py<br/>Query Logging]
        
        B --> B8[Models]
        B8 --> B8a[User<br/>email, role, is_active]
        B8 --> B8b[QueryLog<br/>query_type, latency]
        B8 --> B8c[RagConfig<br/>key/value]
        
        B6a <--> B8
        B6b <--> B7a
    end

    subgraph "AZURE SQL - STORED PROCEDURES"
        B6b --> C1[usp_FindSimilarClinicalCases<br/>Vector Similarity]
        B6b --> C2[usp_RRFSearchClinicalCases<br/>Reciprocal Rank Fusion]
        B6b --> C3[usp_ClearPath_RAG_Search<br/>Full RAG Pipeline]
    end

    subgraph "INFRASTRUCTURE"
        D[Docker Compose]
        D --> D1[postgres:16-alpine<br/>PostgreSQL]
        D --> D2[backend<br/>FastAPI + uvicorn]
        D --> D3[frontend<br/>Vite + React]
        D1 --> D4[alembic<br/>Migrations]
        D2 --> D4
    end

    style A fill:#e3f2fd,stroke:#1976d2
    style B fill:#f3e5f5,stroke:#7b1fa2
    style C1 fill:#fff3e0,stroke:#ef6c00
    style C2 fill:#fff3e0,stroke:#ef6c00
    style C3 fill:#fff3e0,stroke:#ef6c00
    style D fill:#f1f8e9,stroke:#689f38
    style D1 fill:#f1f8e9,stroke:#689f38
    style D4 fill:#f1f8e9,stroke:#689f38
```

## Architecture Overview

### 1. **Client Layer**
- **Frontend**: React/TypeScript SPA using Vite, running on port 5173
- **Backend**: FastAPI REST API, running on port 8000

### 2. **Frontend Architecture**
- **State Management**: Context API (`AuthContext`)
- **Routing**: React Router DOM
- **Protected Routes**: Role-based access control (admin/clinician)
- **API Client**: Axios with JWT token interceptor

### 3. **Backend Architecture**
- **Framework**: FastAPI with async support
- **Authentication**: JWT tokens with bcrypt password hashing
- **Rate Limiting**: SlowAPI with per-IP limits (10 req/min for RAG)
- **CORS**: Configurable origins via settings

### 4. **Data Layer**
| Database | Purpose | Tables |
|----------|---------|--------|
| **PostgreSQL** | User/Auth management | users, query_logs, rag_config |
| **Azure SQL** | Clinical cases with vector embeddings | ClinicalCases, Embeddings |

### 5. **RAG Pipeline**
```
User Query → [RAG Service] → Azure SQL Stored Procedures
                                    ├── usp_ClearPath_RAG_Search (full pipeline)
                                    ├── usp_RRFSearchClinicalCases (hybrid)
                                    └── usp_FindSimilarClinicalCases (vector only)
```

### 6. **Configuration**
- Environment variables via `.env` (Pydantic settings)
- RAG parameters: `top_n`, `embedding_type`, `vector_weight`, `keyword_weight`, `rrf_k`
- Default embedding: `FullCase`