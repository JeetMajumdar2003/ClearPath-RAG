export type UserRole = 'admin' | 'clinician'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export type QueryType = 'rag' | 'vector' | 'hybrid'
export type QueryStatus = 'success' | 'error'

export interface ClinicalCase {
  case_id: number
  patient_age?: number | null
  gender?: string | null
  chief_complaint?: string | null
  diagnosis?: string | null
  severity?: string | null
  treatment_plan?: string | null
  similarity?: number | null
  vector_distance?: number | null
  keyword_score?: number | null
  hybrid_score?: number | null
}

export interface RagQueryRequest {
  patient_description: string
  keyword_search: string
  top_n: number
  embedding_type: string
  vector_weight: number
  keyword_weight: number
  rrf_k: number
}

export interface RagQueryResponse {
  cases: ClinicalCase[]
  clinical_summary: string | null
  latency_ms: number
}

export interface SearchResponse {
  cases: ClinicalCase[]
  latency_ms: number
}

export interface VectorSearchRequest {
  case_text: string
  top_k: number
  embedding_type: string
}

export interface HybridSearchRequest {
  query_text: string
  keyword_search: string
  top_n: number
  embedding_type: string
  vector_weight: number
  keyword_weight: number
  rrf_k: number
}

export interface QueryLog {
  id: number
  user_id: number
  user_email?: string | null
  query_type: QueryType
  patient_description?: string | null
  keyword_search?: string | null
  top_n?: number | null
  embedding_type?: string | null
  vector_weight?: number | null
  keyword_weight?: number | null
  latency_ms?: number | null
  status: QueryStatus
  error_message?: string | null
  created_at: string
}

export interface PaginatedLogs {
  items: QueryLog[]
  total: number
  page: number
  page_size: number
}

export interface DashboardOverview {
  queries_today: number
  total_queries: number
  avg_latency_ms: number
  success_rate: number
  clinical_case_count: number | null
  azure_sql_connected: boolean
}

export interface UsageDataPoint {
  date: string
  count: number
  query_type?: string | null
}

export interface AnalyticsUsage {
  daily: UsageDataPoint[]
  by_type: UsageDataPoint[]
}

export interface AnalyticsPerformance {
  avg_latency_ms: number
  p50_latency_ms: number
  p95_latency_ms: number
  error_count: number
  success_count: number
}

export interface RagConfigItem {
  key: string
  value: string
}

export interface RagConfigUpdate {
  top_n?: number
  embedding_type?: string
  vector_weight?: number
  keyword_weight?: number
  rrf_k?: number
}

export interface HealthResponse {
  status: string
  azure_sql_connected: boolean
}