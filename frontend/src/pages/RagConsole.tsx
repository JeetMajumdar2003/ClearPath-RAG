import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Sparkles, Send, AlertTriangle, Sliders } from 'lucide-react'
import api from '@/lib/api'
import type {
  RagConfigItem,
  RagQueryRequest,
  RagQueryResponse,
} from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Feedback'
import { formatLatency, truncate } from '@/lib/utils'

const DEFAULT_REQUEST: RagQueryRequest = {
  patient_description: '',
  keyword_search: '',
  top_n: 5,
  embedding_type: 'FullCase',
  vector_weight: 0.6,
  keyword_weight: 0.4,
  rrf_k: 60,
}

export default function RagConsolePage() {
  const [form, setForm] = useState<RagQueryRequest>(DEFAULT_REQUEST)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [result, setResult] = useState<RagQueryResponse | null>(null)

  const configQuery = useQuery<RagConfigItem[]>({
    queryKey: ['rag', 'config'],
    queryFn: async () => (await api.get<RagConfigItem[]>('/api/v1/rag/config')).data,
  })

  const applyConfigDefaults = () => {
    if (!configQuery.data) return
    const map: Record<string, string> = Object.fromEntries(configQuery.data.map((c) => [c.key, c.value]))
    setForm((f) => ({
      ...f,
      top_n: Number(map.top_n ?? f.top_n),
      embedding_type: map.embedding_type ?? f.embedding_type,
      vector_weight: Number(map.vector_weight ?? f.vector_weight),
      keyword_weight: Number(map.keyword_weight ?? f.keyword_weight),
      rrf_k: Number(map.rrf_k ?? f.rrf_k),
    }))
  }

  const mutation = useMutation({
    mutationFn: async (payload: RagQueryRequest) =>
      (await api.post<RagQueryResponse>('/api/v1/rag/query', payload)).data,
    onSuccess: (data) => setResult(data),
  })

  const canSubmit =
    form.patient_description.trim().length >= 10 &&
    form.keyword_search.trim().length >= 3 &&
    !mutation.isPending

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">RAG Console</h1>
        <p className="text-sm text-slate-500 mt-1">
          Retrieve similar clinical cases and generate a grounded summary with GPT-4o.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Patient description</CardTitle>
                <CardDescription>Describe the case — used for embedding + retrieval.</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                <Sliders className="h-4 w-4" />
                {showAdvanced ? 'Hide' : 'Show'} advanced
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              rows={6}
              placeholder="e.g. 62-year-old male with chest pain radiating to left arm, ECG shows ST elevation…"
              value={form.patient_description}
              onChange={(e) => setForm({ ...form, patient_description: e.target.value })}
            />

            <div className="space-y-1.5">
              <Label htmlFor="kw">Keyword search</Label>
              <Input
                id="kw"
                placeholder="e.g. myocardial infarction"
                value={form.keyword_search}
                onChange={(e) => setForm({ ...form, keyword_search: e.target.value })}
              />
            </div>

            {showAdvanced && (
              <div className="grid gap-4 sm:grid-cols-2 border-t border-slate-100 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="topn">Top N</Label>
                  <Input
                    id="topn"
                    type="number"
                    min={1}
                    max={100}
                    value={form.top_n}
                    onChange={(e) => setForm({ ...form, top_n: Number(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="embed">Embedding type</Label>
                  <Select
                    id="embed"
                    value={form.embedding_type}
                    onChange={(e) => setForm({ ...form, embedding_type: e.target.value })}
                  >
                    <option value="FullCase">Full case</option>
                    <option value="DiagnosisOnly">Diagnosis only</option>
                    <option value="ChiefComplaintOnly">Chief complaint only</option>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vw">Vector weight ({form.vector_weight.toFixed(2)})</Label>
                  <input
                    id="vw"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={form.vector_weight}
                    onChange={(e) => setForm({ ...form, vector_weight: Number(e.target.value) })}
                    className="w-full accent-teal-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kw_w">Keyword weight ({form.keyword_weight.toFixed(2)})</Label>
                  <input
                    id="kw_w"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={form.keyword_weight}
                    onChange={(e) => setForm({ ...form, keyword_weight: Number(e.target.value) })}
                    className="w-full accent-teal-600"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="rrfk">RRF k</Label>
                  <Input
                    id="rrfk"
                    type="number"
                    min={1}
                    value={form.rrf_k}
                    onChange={(e) => setForm({ ...form, rrf_k: Number(e.target.value) || 60 })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button variant="outline" size="sm" onClick={applyConfigDefaults}>
                    Apply stored defaults from Settings
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">
                Rate limit: 10 requests / minute per IP.
              </p>
              <Button onClick={() => mutation.mutate(form)} disabled={!canSubmit}>
                {mutation.isPending ? <Spinner size="sm" /> : <Send className="h-4 w-4" />}
                Run RAG query
              </Button>
            </div>

            {mutation.isError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {(mutation.error as Error)?.message ?? 'RAG query failed'}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-teal-600" />
              Clinical summary
            </CardTitle>
            <CardDescription>Generated by GPT-4o over retrieved cases.</CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div className="space-y-3">
                <div className="rounded-md border border-teal-200 bg-teal-50/40 p-3 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {result.clinical_summary || 'No summary returned.'}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Retrieved {result.cases.length} cases</span>
                  <span className="font-mono">{formatLatency(result.latency_ms)}</span>
                </div>
                <div className="border-t border-amber-200 bg-amber-50/60 rounded-md p-2.5 flex gap-2 text-xs text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    AI-generated content for clinician review only. Not a substitute for medical judgment
                    or definitive diagnosis.
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Run a query to see the generated summary.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Retrieved cases</CardTitle>
            <CardDescription>{result.cases.length} matches · sorted by similarity</CardDescription>
          </CardHeader>
          <CardContent>
            {result.cases.length === 0 ? (
              <p className="text-sm text-slate-500">No matching cases found.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {result.cases.map((c) => (
                  <CaseCard key={c.case_id} case={c} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function CaseCard({ case: c }: { case: RagQueryResponse['cases'][number] }) {
  return (
    <div className="rounded-md border border-slate-200 p-4 bg-white hover:border-teal-300 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-500">#{c.case_id}</span>
          <Badge variant="outline">{c.gender ?? '—'}</Badge>
          <Badge variant="secondary">{c.severity ?? '—'}</Badge>
        </div>
        <span className="text-xs text-teal-700 font-mono">
          sim {c.similarity?.toFixed(3) ?? c.hybrid_score?.toFixed(3) ?? '—'}
        </span>
      </div>
      <p className="text-sm font-medium text-slate-900 mb-1">
        {c.chief_complaint ?? '—'}
      </p>
      <p className="text-xs text-slate-600 mb-2">
        <span className="font-semibold text-slate-700">Dx:</span> {truncate(c.diagnosis, 120) || '—'}
      </p>
      <p className="text-xs text-slate-500">
        <span className="font-semibold text-slate-700">Tx:</span> {truncate(c.treatment_plan, 160) || '—'}
      </p>
      <div className="mt-2 flex justify-between text-[11px] text-slate-400">
        <span>Age {c.patient_age ?? '—'}</span>
        {c.vector_distance !== null && c.vector_distance !== undefined && (
          <span>dist {c.vector_distance.toFixed(3)}</span>
        )}
      </div>
    </div>
  )
}