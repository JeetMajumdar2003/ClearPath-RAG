import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import api from '@/lib/api'
import type { AnalyticsPerformance, AnalyticsUsage } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Feedback'
import { formatLatency } from '@/lib/utils'

const TYPE_COLORS: Record<string, string> = {
  rag: '#0D9488',
  vector: '#6366F1',
  hybrid: '#F59E0B',
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)

  const usage = useQuery<AnalyticsUsage>({
    queryKey: ['analytics', 'usage', days],
    queryFn: async () => (await api.get<AnalyticsUsage>('/api/v1/analytics/usage', { params: { days } })).data,
  })

  const perf = useQuery<AnalyticsPerformance>({
    queryKey: ['analytics', 'performance', days],
    queryFn: async () =>
      (await api.get<AnalyticsPerformance>('/api/v1/analytics/performance', { params: { days } })).data,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Usage trends and latency percentiles across all RAG operations.
          </p>
        </div>
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-32">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 365 days</option>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Avg latency"
          value={formatLatency(Math.round(perf.data?.avg_latency_ms ?? 0))}
        />
        <Metric label="p50 latency" value={formatLatency(Math.round(perf.data?.p50_latency_ms ?? 0))} />
        <Metric label="p95 latency" value={formatLatency(Math.round(perf.data?.p95_latency_ms ?? 0))} />
        <Metric
          label="Error count"
          value={perf.data?.error_count ?? 0}
          hint={`${perf.data?.success_count ?? 0} successful`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Queries over time</CardTitle>
            <CardDescription>Daily count of all RAG, vector, and hybrid queries.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {usage.isLoading ? (
              <div className="flex h-full items-center justify-center"><Spinner /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usage.data?.daily ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748B" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748B" allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0' }} />
                  <Line type="monotone" dataKey="count" stroke="#0D9488" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By type</CardTitle>
            <CardDescription>Distribution of query kinds.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {usage.isLoading ? (
              <div className="flex h-full items-center justify-center"><Spinner /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={usage.data?.by_type ?? []}
                    dataKey="count"
                    nameKey="query_type"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {(usage.data?.by_type ?? []).map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={TYPE_COLORS[entry.query_type ?? ''] ?? '#94A3B8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queries by type (bar)</CardTitle>
          <CardDescription>Compare RAG, vector, and hybrid search volume.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {usage.isLoading ? (
            <div className="flex h-full items-center justify-center"><Spinner /></div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usage.data?.by_type ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="query_type" tick={{ fontSize: 12 }} stroke="#64748B" />
                <YAxis tick={{ fontSize: 11 }} stroke="#64748B" allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0' }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {(usage.data?.by_type ?? []).map((entry, idx) => (
                    <Cell key={idx} fill={TYPE_COLORS[entry.query_type ?? ''] ?? '#94A3B8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-semibold text-slate-900 mt-2">{value}</p>
        {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      </CardContent>
    </Card>
  )
}