import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Stethoscope,
  Timer,
  TrendingUp,
} from 'lucide-react'
import api from '@/lib/api'
import type { DashboardOverview, PaginatedLogs } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Feedback'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate, formatLatency, truncate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string | number
  hint?: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</p>
            <p className="text-2xl font-semibold text-slate-900 mt-2">{value}</p>
            {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()

  const { data: overview, isLoading: loadingOverview } = useQuery<DashboardOverview>({
    queryKey: ['dashboard', 'overview'],
    queryFn: async () => (await api.get<DashboardOverview>('/api/v1/dashboard/overview')).data,
    refetchInterval: 15_000,
  })

  const { data: logs } = useQuery<PaginatedLogs>({
    queryKey: ['dashboard', 'recent-logs'],
    queryFn: async () =>
      (await api.get<PaginatedLogs>('/api/v1/logs', { params: { page: 1, page_size: 6 } })).data,
    refetchInterval: 15_000,
  })

  if (loadingOverview) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {user?.full_name?.split(' ')[0] ?? 'Clinician'}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Live overview of RAG activity, performance, and Azure SQL connectivity.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/app/logs">View logs</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/app/rag">Open RAG Console</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Queries today"
          value={overview?.queries_today ?? 0}
          hint={`${overview?.total_queries ?? 0} total`}
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          label="Avg latency"
          value={formatLatency(Math.round(overview?.avg_latency_ms ?? 0))}
          hint="Across all query types"
          icon={<Timer className="h-5 w-5" />}
        />
        <StatCard
          label="Success rate"
          value={`${(overview?.success_rate ?? 100).toFixed(1)}%`}
          hint="Last 30 days"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Clinical cases"
          value={overview?.clinical_case_count ?? '—'}
          hint="Loaded in Azure SQL"
          icon={<Database className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest RAG queries, vector searches, and hybrid retrievals.</CardDescription>
          </CardHeader>
          <CardContent>
            {logs?.items?.length ? (
              <div className="space-y-3">
                {logs.items.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-slate-100 bg-slate-50/40 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            log.query_type === 'rag'
                              ? 'default'
                              : log.query_type === 'hybrid'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {log.query_type}
                        </Badge>
                        {log.status === 'success' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                        )}
                        <span className="text-xs text-slate-500">{formatDate(log.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-800 mt-1 truncate">
                        {truncate(log.patient_description ?? log.keyword_search ?? '', 120)}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500 font-mono shrink-0">
                      {formatLatency(log.latency_ms)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 py-4 text-center">No queries yet. Open the RAG Console to run one.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System status</CardTitle>
            <CardDescription>Connectivity and integrations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow
              label="Azure SQL Database"
              ok={overview?.azure_sql_connected ?? false}
              detail="Stored procedures reachable"
            />
            <StatusRow label="Vector index" ok={true} detail="Cosine similarity" />
            <StatusRow label="Full-text search" ok={true} detail="Keyword retrieval" />
            <StatusRow label="GPT-4o generation" ok={true} detail="External model via SQL" />

            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>Auto-refresh every 15 seconds</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-linear-to-br from-teal-50 to-white border-teal-100">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-600 text-white shrink-0">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Try a sample query</h3>
            <p className="text-sm text-slate-600 mt-1">
              Open the RAG Console and enter a patient description to retrieve similar clinical cases
              and generate a grounded summary with GPT-4o.
            </p>
            <Button asChild className="mt-3" size="sm">
              <Link to="/app/rag">Launch RAG Console</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
      <Badge variant={ok ? 'success' : 'danger'}>{ok ? 'Online' : 'Offline'}</Badge>
    </div>
  )
}