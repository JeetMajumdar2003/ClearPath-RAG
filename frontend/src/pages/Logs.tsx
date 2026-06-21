import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import type { PaginatedLogs, QueryLog, QueryStatus, QueryType } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Feedback'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { formatDate, formatLatency, truncate } from '@/lib/utils'

export default function LogsPage() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [status, setStatus] = useState<QueryStatus | ''>('')
  const [queryType, setQueryType] = useState<QueryType | ''>('')

  const { data, isFetching, refetch } = useQuery<PaginatedLogs>({
    queryKey: ['logs', page, pageSize, status, queryType],
    queryFn: async () =>
      (
        await api.get<PaginatedLogs>('/api/v1/logs', {
          params: {
            page,
            page_size: pageSize,
            status: status || undefined,
            query_type: queryType || undefined,
          },
        })
      ).data,
    refetchOnWindowFocus: false,
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Query logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Audit trail for every RAG, vector, and hybrid search executed by users.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>
                <Filter className="inline h-4 w-4 mr-1 text-slate-400" /> Filter &amp; results
              </CardTitle>
              <CardDescription>
                {data ? `${data.total.toLocaleString()} total · page ${data.page} of ${totalPages}` : 'Loading…'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={status} onChange={(e) => { setStatus(e.target.value as QueryStatus | ''); setPage(1) }}>
                <option value="">All statuses</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
              </Select>
              <Select value={queryType} onChange={(e) => { setQueryType(e.target.value as QueryType | ''); setPage(1) }}>
                <option value="">All types</option>
                <option value="rag">RAG</option>
                <option value="vector">Vector</option>
                <option value="hybrid">Hybrid</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {data?.items?.length ? (
            <LogsTable logs={data.items} />
          ) : isFetching ? (
            <div className="flex h-32 items-center justify-center"><Spinner /></div>
          ) : (
            <p className="text-sm text-slate-500 py-8 text-center">No logs found.</p>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4">
            <p className="text-xs text-slate-500">
              Showing {data?.items?.length ?? 0} of {data?.total ?? 0}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="text-sm font-mono px-2">{page}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function LogsTable({ logs }: { logs: QueryLog[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-32">When</TableHead>
          <TableHead className="w-24">Type</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Query</TableHead>
          <TableHead className="w-24">Status</TableHead>
          <TableHead className="text-right w-24">Latency</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((l) => (
          <TableRow key={l.id}>
            <TableCell className="text-xs text-slate-600">{formatDate(l.created_at)}</TableCell>
            <TableCell>
              <Badge variant={l.query_type === 'rag' ? 'default' : l.query_type === 'hybrid' ? 'secondary' : 'outline'}>
                {l.query_type}
              </Badge>
            </TableCell>
            <TableCell className="text-xs">{l.user_email ?? `user #${l.user_id}`}</TableCell>
            <TableCell className="text-sm">
              <div className="max-w-md">
                <p className="truncate">{truncate(l.patient_description ?? l.keyword_search ?? '', 80)}</p>
                {l.error_message && (
                  <p className="text-xs text-red-600 mt-0.5 truncate">⚠ {l.error_message}</p>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={l.status === 'success' ? 'success' : 'danger'}>{l.status}</Badge>
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {formatLatency(l.latency_ms)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}