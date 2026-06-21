import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import * as Tabs from '@radix-ui/react-tabs'
import { Search as SearchIcon, Database, Combine } from 'lucide-react'
import api from '@/lib/api'
import type {
  ClinicalCase,
  HybridSearchRequest,
  SearchResponse,
  VectorSearchRequest,
} from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Spinner } from '@/components/ui/Feedback'
import { formatLatency } from '@/lib/utils'

export default function SearchExplorerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Search Explorer</h1>
        <p className="text-sm text-slate-500 mt-1">
          Run vector-only or hybrid (vector + keyword RRF) searches directly against Azure SQL.
        </p>
      </div>

      <Tabs.Root defaultValue="vector">
        <Tabs.List className="inline-flex items-center rounded-md border border-slate-200 bg-white p-1">
          <Tabs.Trigger
            value="vector"
            className="flex items-center gap-2 rounded-sm px-4 py-1.5 text-sm font-medium text-slate-600 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700"
          >
            <Database className="h-4 w-4" /> Vector search
          </Tabs.Trigger>
          <Tabs.Trigger
            value="hybrid"
            className="flex items-center gap-2 rounded-sm px-4 py-1.5 text-sm font-medium text-slate-600 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700"
          >
            <Combine className="h-4 w-4" /> Hybrid (RRF)
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="vector" className="mt-4">
          <VectorPanel />
        </Tabs.Content>
        <Tabs.Content value="hybrid" className="mt-4">
          <HybridPanel />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

function VectorPanel() {
  const [text, setText] = useState('')
  const [topK, setTopK] = useState(5)
  const [embeddingType, setEmbeddingType] = useState('FullCase')
  const [results, setResults] = useState<{ cases: ClinicalCase[]; latency_ms: number } | null>(null)

  const mutation = useMutation({
    mutationFn: async (payload: VectorSearchRequest) =>
      (await api.post<SearchResponse>('/api/v1/rag/search/vector', payload)).data,
    onSuccess: (data) => setResults(data),
  })

  const canSubmit = text.trim().length >= 10 && !mutation.isPending

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Query</CardTitle>
          <CardDescription>Cosine similarity against vector index.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="v-text">Case text</Label>
            <Textarea
              id="v-text"
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Describe the case to embed and search…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-k">Top K</Label>
              <Input
                id="v-k"
                type="number"
                min={1}
                max={100}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-embed">Embedding</Label>
              <Select
                id="v-embed"
                value={embeddingType}
                onChange={(e) => setEmbeddingType(e.target.value)}
              >
                <option value="FullCase">FullCase</option>
                <option value="DiagnosisOnly">DiagnosisOnly</option>
                <option value="ChiefComplaintOnly">ChiefComplaintOnly</option>
              </Select>
            </div>
          </div>
          <Button onClick={() => mutation.mutate({ case_text: text, top_k: topK, embedding_type: embeddingType })} disabled={!canSubmit} className="w-full">
            {mutation.isPending ? <Spinner size="sm" /> : <SearchIcon className="h-4 w-4" />}
            Run vector search
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            {results ? `${results.cases.length} matches · ${formatLatency(results.latency_ms)}` : 'Run a query to see results'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results && results.cases.length > 0 ? (
            <ResultsTable cases={results.cases} scoreKey="similarity" />
          ) : (
            <p className="text-sm text-slate-500">No results yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function HybridPanel() {
  const [queryText, setQueryText] = useState('')
  const [keywordSearch, setKeywordSearch] = useState('')
  const [topN, setTopN] = useState(10)
  const [embeddingType, setEmbeddingType] = useState('FullCase')
  const [vectorWeight, setVectorWeight] = useState(0.6)
  const [keywordWeight, setKeywordWeight] = useState(0.4)
  const [rrfK, setRrfK] = useState(60)
  const [results, setResults] = useState<{ cases: ClinicalCase[]; latency_ms: number } | null>(null)

  const mutation = useMutation({
    mutationFn: async (payload: HybridSearchRequest) =>
      (await api.post<SearchResponse>('/api/v1/rag/search/hybrid', payload)).data,
    onSuccess: (data) => setResults(data),
  })

  const canSubmit =
    queryText.trim().length >= 10 && keywordSearch.trim().length >= 3 && !mutation.isPending

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Query</CardTitle>
          <CardDescription>Reciprocal Rank Fusion of vector + keyword.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="h-qt">Query text</Label>
            <Textarea
              id="h-qt"
              rows={4}
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Used for embedding + vector ranking"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-kw">Keyword search</Label>
            <Input
              id="h-kw"
              value={keywordSearch}
              onChange={(e) => setKeywordSearch(e.target.value)}
              placeholder="e.g. chest pain ECG ST"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="h-topn">Top N</Label>
              <Input
                id="h-topn"
                type="number"
                min={1}
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-embed">Embedding</Label>
              <Select
                id="h-embed"
                value={embeddingType}
                onChange={(e) => setEmbeddingType(e.target.value)}
              >
                <option value="FullCase">FullCase</option>
                <option value="DiagnosisOnly">DiagnosisOnly</option>
                <option value="ChiefComplaintOnly">ChiefComplaintOnly</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="h-vw">Vector weight ({vectorWeight.toFixed(2)})</Label>
              <input
                id="h-vw"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={vectorWeight}
                onChange={(e) => setVectorWeight(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-kw_w">Keyword weight ({keywordWeight.toFixed(2)})</Label>
              <input
                id="h-kw_w"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={keywordWeight}
                onChange={(e) => setKeywordWeight(Number(e.target.value))}
                className="w-full accent-teal-600"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-k">RRF k</Label>
            <Input
              id="h-k"
              type="number"
              min={1}
              value={rrfK}
              onChange={(e) => setRrfK(Number(e.target.value) || 60)}
            />
          </div>
          <Button
            onClick={() =>
              mutation.mutate({
                query_text: queryText,
                keyword_search: keywordSearch,
                top_n: topN,
                embedding_type: embeddingType,
                vector_weight: vectorWeight,
                keyword_weight: keywordWeight,
                rrf_k: rrfK,
              })
            }
            disabled={!canSubmit}
            className="w-full"
          >
            {mutation.isPending ? <Spinner size="sm" /> : <SearchIcon className="h-4 w-4" />}
            Run hybrid search
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Results</CardTitle>
          <CardDescription>
            {results ? `${results.cases.length} matches · ${formatLatency(results.latency_ms)}` : 'Run a query to see results'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results && results.cases.length > 0 ? (
            <ResultsTable cases={results.cases} scoreKey="hybrid_score" />
          ) : (
            <p className="text-sm text-slate-500">No results yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ResultsTable({ cases, scoreKey }: { cases: ClinicalCase[]; scoreKey: 'similarity' | 'hybrid_score' }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Case</TableHead>
          <TableHead>Chief complaint</TableHead>
          <TableHead>Diagnosis</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead className="text-right">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cases.map((c) => (
          <TableRow key={c.case_id}>
            <TableCell className="font-mono text-xs">#{c.case_id}</TableCell>
            <TableCell className="text-sm">{c.chief_complaint ?? '—'}</TableCell>
            <TableCell className="text-sm">{c.diagnosis ?? '—'}</TableCell>
            <TableCell className="text-xs">{c.severity ?? '—'}</TableCell>
            <TableCell className="text-right font-mono text-xs text-teal-700">
              {(() => {
                const v = scoreKey === 'similarity' ? c.similarity : c.hybrid_score
                return v !== null && v !== undefined ? v.toFixed(4) : '—'
              })()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}