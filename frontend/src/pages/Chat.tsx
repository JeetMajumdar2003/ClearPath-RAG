import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Send,
  Sparkles,
  Plus,
  Sliders,
  Copy,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  History,
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import type {
  ClinicalCase,
  RagConfigItem,
  RagQueryRequest,
  RagQueryResponse,
} from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Feedback'
import { Badge } from '@/components/ui/Badge'
import { cn, formatLatency } from '@/lib/utils'

type ChatRole = 'user' | 'assistant'

interface ChatMessage {
  id: string
  role: ChatRole
  /** Plain text or patient description */
  content: string
  /** Timestamp label */
  timestamp: string
  /** Server response (assistant only) */
  response?: RagQueryResponse
  /** In-flight or errored request */
  pending?: boolean
  error?: string
  /** Retrieval settings used for this turn */
  settings: RetrievalSettings
}

interface RetrievalSettings {
  topN: number
  vectorWeight: number
  keywordWeight: number
  embeddingType: string
}

const DEFAULT_SETTINGS: RetrievalSettings = {
  topN: 5,
  vectorWeight: 0.6,
  keywordWeight: 0.4,
  embeddingType: 'FullCase',
}

const TOP_N_OPTIONS = [3, 5, 10, 20]
const WEIGHT_PRESETS: Array<{ label: string; vector: number; keyword: number }> = [
  { label: 'Vector 80/20', vector: 0.8, keyword: 0.2 },
  { label: 'Hybrid 60/40', vector: 0.6, keyword: 0.4 },
  { label: 'Hybrid 50/50', vector: 0.5, keyword: 0.5 },
  { label: 'Keyword 80/20', vector: 0.2, keyword: 0.8 },
]

function uid() {
  return Math.random().toString(36).slice(2, 11)
}

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/**
 * Lightweight formatter for the clinical summary returned by the SP.
 * Splits on double newlines, treats **bold** markers, and renders bullet lists.
 */
function renderSummary(text: string | null | undefined) {
  if (!text) return null
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  return paragraphs.map((para, idx) => {
    const lines = para.split(/\n/).map((l) => l.trim()).filter(Boolean)
    // Bullet list
    if (lines.length > 1 && lines.every((l) => /^[-*•]\s+/.test(l) || l.length < 2)) {
      return (
        <ul key={idx} className="list-disc pl-5 space-y-1 text-sm text-slate-700">
          {lines.map((l, i) => (
            <li key={i}>{renderInline(l.replace(/^[-*•]\s+/, ''))}</li>
          ))}
        </ul>
      )
    }
    // Numbered list
    if (lines.length > 1 && lines.every((l) => /^\d+\.\s+/.test(l))) {
      return (
        <ol key={idx} className="list-decimal pl-5 space-y-1 text-sm text-slate-700">
          {lines.map((l, i) => (
            <li key={i}>{renderInline(l.replace(/^\d+\.\s+/, ''))}</li>
          ))}
        </ol>
      )
    }
    return (
      <p key={idx} className="text-sm leading-relaxed text-slate-700">
        {renderInline(para)}
      </p>
    )
  })
}

function renderInline(text: string) {
  // Simple **bold** rendering
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.replace(/\*\*/g, '')}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function weightLabel(v: number, k: number) {
  return `Hybrid ${Math.round(v * 100)}/${Math.round(k * 100)}`
}

export default function ChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [settings, setSettings] = useState<RetrievalSettings>(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [expandedCases, setExpandedCases] = useState<Record<string, boolean>>({})
  const [historyOpen, setHistoryOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Pull RAG config defaults once (admin can change them on the Settings page).
  const configQuery = useQuery<RagConfigItem[]>({
    queryKey: ['rag', 'config'],
    queryFn: async () => (await api.get<RagConfigItem[]>('/api/v1/rag/config')).data,
  })

  useEffect(() => {
    if (configQuery.data) {
      const map = Object.fromEntries(configQuery.data.map((c) => [c.key, c.value]))
      setSettings((s) => ({
        ...s,
        topN: Number(map.top_n ?? s.topN),
        embeddingType: map.embedding_type ?? s.embeddingType,
        vectorWeight: Number(map.vector_weight ?? s.vectorWeight),
        keywordWeight: Number(map.keyword_weight ?? s.keywordWeight),
      }))
    }
  }, [configQuery.data])

  // Auto-scroll on new content.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // Latest retrieval context shown in the right panel.
  const latestAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant' && m.response),
    [messages]
  )
  const retrievedCases: ClinicalCase[] = latestAssistant?.response?.cases ?? []

  const mutation = useMutation({
    mutationFn: async (payload: RagQueryRequest) =>
      (await api.post<RagQueryResponse>('/api/v1/rag/query', payload)).data,
  })

  function send() {
    const text = input.trim()
    if (!text || text.length < 10) return
    const requestSettings = { ...settings }
    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: text,
      timestamp: nowLabel(),
      settings: requestSettings,
    }
    const pendingMsg: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      timestamp: nowLabel(),
      pending: true,
      settings: requestSettings,
    }
    setMessages((prev) => [...prev, userMsg, pendingMsg])
    setInput('')

    const payload: RagQueryRequest = {
      patient_description: text,
      keyword_search: text.split(/\s+/).slice(0, 3).join(' '),
      top_n: requestSettings.topN,
      embedding_type: requestSettings.embeddingType,
      vector_weight: requestSettings.vectorWeight,
      keyword_weight: requestSettings.keywordWeight,
      rrf_k: 60,
    }
    mutation.mutate(payload, {
      onSuccess: (data) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsg.id
              ? {
                  ...m,
                  pending: false,
                  response: data,
                }
              : m
          )
        )
      },
      onError: (err: any) => {
        const detail = err?.response?.data?.detail ?? err?.message ?? 'Unknown error'
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingMsg.id
              ? {
                  ...m,
                  pending: false,
                  error: typeof detail === 'string' ? detail : JSON.stringify(detail),
                }
              : m
          )
        )
      },
    })
  }

  function regenerate(assistantId: string) {
    const idx = messages.findIndex((m) => m.id === assistantId)
    if (idx < 1) return
    const userMsg = messages[idx - 1]
    if (!userMsg || userMsg.role !== 'user') return
    setInput(userMsg.content)
    // Remove the failed turn so the next send replaces it.
    setMessages((prev) => prev.filter((m) => m.id !== assistantId && m.id !== userMsg.id))
    // Focus the textarea and submit.
    setTimeout(() => {
      textareaRef.current?.focus()
      send()
    }, 0)
  }

  function copySummary(text: string | null | undefined) {
    if (!text) return
    navigator.clipboard?.writeText(text).catch(() => {
      /* no-op */
    })
  }

  function startNewConversation() {
    setMessages([])
    setExpandedCases({})
  }

  const activeWeightLabel = weightLabel(settings.vectorWeight, settings.keywordWeight)

  return (
    <div className="h-full flex bg-slate-50">
      {/* ====================== HISTORY SIDEBAR ====================== */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r border-slate-200 bg-white transition-all duration-300',
          historyOpen ? 'md:w-64' : 'md:w-14'
        )}
      >
        <div className="flex h-14 items-center justify-between px-3 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex items-center justify-center rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label={historyOpen ? 'Hide history' : 'Show history'}
          >
            <History className="h-4 w-4" />
          </button>
          {historyOpen && (
            <Button variant="outline" size="sm" onClick={startNewConversation} className="ml-auto">
              <Plus className="h-4 w-4" />
              New chat
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
          {historyOpen ? (
            <div className="space-y-1">
              <p className="px-2 text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">
                Recent
              </p>
              {messages.length === 0 ? (
                <p className="px-2 text-xs text-slate-400">No conversations yet.</p>
              ) : (
                <button
                  type="button"
                  onClick={startNewConversation}
                  className="w-full text-left rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 hover:border-teal-300 hover:shadow-sm transition"
                >
                  Current session
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 pt-2">
              <button
                type="button"
                onClick={startNewConversation}
                className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                title="New chat"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ====================== CHAT COLUMN ====================== */}
      <section className="flex flex-col flex-1 min-w-0 relative">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin pb-40">
          {messages.length === 0 ? (
            <EmptyChat onPick={(text) => setInput(text)} userName={user?.full_name} />
          ) : (
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  expandedCases={expandedCases}
                  setExpandedCases={setExpandedCases}
                  onCopy={copySummary}
                  onRegenerate={() => regenerate(m.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-50 via-slate-50 to-transparent pt-6 pb-2 px-6">
          <div className="mx-auto max-w-3xl">
            {settingsOpen && (
              <div className="mb-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Top N
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {TOP_N_OPTIONS.map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSettings((s) => ({ ...s, topN: n }))}
                          className={cn(
                            'rounded-md border px-2 py-1 text-xs',
                            settings.topN === n
                              ? 'border-teal-600 bg-teal-600 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Hybrid weight
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {WEIGHT_PRESETS.map((p) => {
                        const active =
                          Math.abs(settings.vectorWeight - p.vector) < 0.01 &&
                          Math.abs(settings.keywordWeight - p.keyword) < 0.01
                        return (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() =>
                              setSettings((s) => ({
                                ...s,
                                vectorWeight: p.vector,
                                keywordWeight: p.keyword,
                              }))
                            }
                            className={cn(
                              'rounded-md border px-2 py-1 text-xs',
                              active
                                ? 'border-teal-600 bg-teal-600 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            )}
                          >
                            {p.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Embedding type
                    </label>
                    <select
                      value={settings.embeddingType}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, embeddingType: e.target.value }))
                      }
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-teal-500 focus:outline-none"
                    >
                      <option value="FullCase">FullCase</option>
                      <option value="SymptomsOnly">SymptomsOnly</option>
                      <option value="DiagnosisOnly">DiagnosisOnly</option>
                      <option value="TreatmentOnly">TreatmentOnly</option>
                      <option value="OutcomeOnly">OutcomeOnly</option>
                    </select>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    {activeWeightLabel} · Top {settings.topN} · {settings.embeddingType}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Rate limit: 10 requests / minute per IP.
                  </span>
                </div>
              </div>
            )}
            {/* Composer */}
            <div className="flex items-end gap-2 rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-lg focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100">
              <textarea
                ref={textareaRef}
                rows={3}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder="Describe the patient presentation, symptoms, and relevant history…"
                className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none min-h-18"
              />
              <button
                type="button"
                onClick={() => setSettingsOpen((v) => !v)}
                className={cn(
                  'flex items-center justify-center rounded-lg border px-2 py-2 text-xs font-medium transition-colors',
                  settingsOpen
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                )}
                title="Retrieval settings"
              >
                <Sliders className="h-4 w-4" />
              </button>
              <Button
                onClick={send}
                disabled={input.trim().length < 10 || mutation.isPending}
                size="sm"
              >
                {mutation.isPending ? (
                  <Spinner size="sm" className="border-white border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send
              </Button>
            </div>
            <div className="mt-1.5 text-[11px] text-slate-400 text-center flex *:items-center justify-between mx-1">
              <p>
                <span className="font-semibold">AI Can make mistakes!</span> Always verify information with clinical guidelines.
              </p>
              <p>
                Press Enter to send · Shift + Enter for new line
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ====================== RETRIEVAL SIDEBAR ====================== */}
      <aside className="hidden xl:flex w-100 flex-col bg-white border-l border-slate-200">
        <header className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-slate-500" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Retrieved cases</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Latest results from the most recent query.</p>
              </div>
            </div>
            <Badge variant="outline">{retrievedCases.length} hits</Badge>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 scrollbar-thin">
          {retrievedCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-10 text-slate-500">
              <Sparkles className="h-7 w-7 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">No cases yet</p>
              <p className="text-xs text-slate-400 mt-1 max-w-65">
                Send a patient description to see the top similar clinical cases here.
              </p>
            </div>
          ) : (
            retrievedCases.map((c, idx) => (
              <CaseCard
                key={`${c.case_id}-${idx}`}
                rank={idx + 1}
                caseItem={c}
                vectorWeight={settings.vectorWeight}
                keywordWeight={settings.keywordWeight}
                expanded={!!expandedCases[`latest-${c.case_id}`]}
                onToggle={() =>
                  setExpandedCases((p) => ({
                    ...p,
                    [`latest-${c.case_id}`]: !p[`latest-${c.case_id}`],
                  }))
                }
              />
            ))
          )}
        </div>

        <footer className="border-t border-slate-200 px-5 py-3 text-[11px] text-slate-400">
          Hybrid score combines vector similarity and keyword relevance.
        </footer>
      </aside>
    </div>
  )
}

/* ----------------------------- Sub-components ----------------------------- */

function EmptyChat({ onPick, userName }: { onPick: (text: string) => void; userName?: string }) {
  const suggestions = [
    '58-year-old woman with progressive exertional dyspnea, orthopnea, and bilateral leg swelling. PMH: HTN, T2DM. Exam: JVP elevated, bibasilar crackles, S3 gallop, pitting edema. BNP 612 pg/mL, eGFR 58.',
    '72-year-old male with sudden onset right hemiparesis and aphasia. PMH: atrial fibrillation, HTN. Last known well 2 hours ago.',
    '34-year-old female with 3 days of fever, productive cough, and right-sided pleuritic chest pain. PMH: nil. Vitals: T 38.7, HR 112, RR 22, SpO2 94% on room air.',
  ]
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900">
          Hello{userName ? `, ${userName.split(' ')[0]}` : ''}
        </h2>
        <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
          Describe a patient presentation to retrieve similar clinical cases and generate a
          GPT-4o summary grounded in your evidence base.
        </p>
      </div>

      <p className="mt-6 mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
        Try a sample case
      </p>
      <div className="grid gap-3 md:grid-cols-1">
        {suggestions.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(s)}
            className="text-left rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 hover:border-teal-300 hover:shadow-sm transition"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  expandedCases,
  setExpandedCases,
  onCopy,
  onRegenerate,
}: {
  message: ChatMessage
  expandedCases: Record<string, boolean>
  setExpandedCases: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  onCopy: (text: string | null | undefined) => void
  onRegenerate: () => void
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <div className="flex items-center justify-end gap-2 text-[11px] text-slate-500 mb-1">
            <span>You</span>
            <span>·</span>
            <span>{message.timestamp}</span>
          </div>
          <div className="rounded-2xl rounded-tr-md bg-teal-600 text-white px-4 py-3 text-sm whitespace-pre-wrap shadow-sm">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  // Assistant message
  return (
    <div className="flex items-start gap-3">
      <div className="h-8 w-8 shrink-0 rounded-full bg-slate-900 text-teal-300 flex items-center justify-center">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1">
          <span className="font-semibold text-slate-900">ClearPath</span>
          <span>·</span>
          <span>{message.timestamp}</span>
          {message.response?.latency_ms !== undefined && (
            <>
              <span>·</span>
              <span>{formatLatency(message.response.latency_ms)}</span>
            </>
          )}
          {message.settings && (
            <Badge variant="outline" className="ml-1">
              Top {message.settings.topN} · {weightLabel(message.settings.vectorWeight, message.settings.keywordWeight)}
            </Badge>
          )}
        </div>

        <div className="rounded-2xl rounded-tl-md border border-slate-200 bg-white px-5 py-4 shadow-sm space-y-3">
          {message.pending && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner size="sm" />
              <span>Streaming response…</span>
            </div>
          )}
          {message.error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Request failed</p>
                <p className="text-xs mt-0.5">{message.error}</p>
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </button>
              </div>
            </div>
          )}
          {message.response && (
            <>
              {renderSummary(message.response.clinical_summary)}
              {message.response.clinical_summary && (
                <div className="flex items-center gap-1 pt-1">
                  <button
                    type="button"
                    onClick={() => onCopy(message.response?.clinical_summary)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                    title="Copy summary"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                    title="Helpful"
                  >
                    <ThumbsUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                    title="Not helpful"
                  >
                    <ThumbsDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Regenerate
                  </button>
                </div>
              )}
              {!message.response.clinical_summary && (
                <p className="text-sm text-slate-500 italic">
                  No clinical summary returned for this query.
                </p>
              )}
            </>
          )}
        </div>

        {/* Inline retrieved cases on narrow screens where the right panel is hidden */}
        {message.response && message.response.cases.length > 0 && (
          <div className="xl:hidden mt-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Retrieved cases ({message.response.cases.length})
            </p>
            {message.response.cases.map((c, idx) => (
              <CaseCard
                key={`${c.case_id}-${idx}`}
                rank={idx + 1}
                caseItem={c}
                vectorWeight={message.settings.vectorWeight}
                keywordWeight={message.settings.keywordWeight}
                expanded={!!expandedCases[`msg-${message.id}-${c.case_id}`]}
                onToggle={() =>
                  setExpandedCases((p) => ({
                    ...p,
                    [`msg-${message.id}-${c.case_id}`]: !p[`msg-${message.id}-${c.case_id}`],
                  }))
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CaseCard({
  rank,
  caseItem,
  vectorWeight,
  keywordWeight,
  expanded,
  onToggle,
}: {
  rank: number
  caseItem: ClinicalCase
  vectorWeight: number
  keywordWeight: number
  expanded: boolean
  onToggle: () => void
}) {
  const hybrid = caseItem.hybrid_score ?? 0
  const vector = caseItem.vector_distance ?? 0
  const keyword = caseItem.keyword_score ?? 0
  const vectorPct = Math.round(vectorWeight * 100)
  const keywordPct = Math.round(keywordWeight * 100)

  return (
    <article className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <header className="grid grid-cols-[24px_1fr_auto] items-center gap-3 px-4 py-3 border-b border-slate-100">
        <span className="text-xs font-semibold text-slate-500">{rank}</span>
        <button
          type="button"
          onClick={onToggle}
          className="text-left flex items-baseline gap-2 min-w-0"
        >
          <span className="font-semibold text-teal-700">CP-{caseItem.case_id}</span>
          <span className="text-xs text-slate-500">
            {caseItem.patient_age ?? '—'}/{caseItem.gender ?? '—'}
          </span>
          <span className="ml-2 text-xs text-slate-700 truncate">
            {caseItem.diagnosis ?? '—'}
          </span>
        </button>
        <div className="text-right">
          <div className="text-xs font-semibold text-slate-900">{hybrid.toFixed(3)}</div>
          <div className="text-[10px] text-slate-500">
            {vectorPct}/{keywordPct}
          </div>
        </div>
      </header>
      <div className="px-4 pt-3">
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="bg-teal-500" style={{ width: `${vectorPct}%` }} />
          <div className="bg-amber-400" style={{ width: `${keywordPct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-1">
          <span>Vector</span>
          <span>Keyword</span>
        </div>
      </div>
      {expanded && (
        <dl className="px-4 py-3 space-y-2 text-xs border-t border-slate-100 mt-3">
          <Detail label="Chief complaint" value={caseItem.chief_complaint} />
          <Detail label="Diagnosis" value={caseItem.diagnosis} />
          <Detail label="Severity" value={caseItem.severity} />
          <Detail label="Treatment plan" value={caseItem.treatment_plan} />
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            <Stat label="Hybrid" value={hybrid.toFixed(4)} />
            <Stat label="Vector dist." value={vector.toFixed(4)} />
            <Stat label="Keyword rank" value={String(keyword)} />
          </div>
        </dl>
      )}
    </article>
  )
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="grid grid-cols-[110px_1fr] gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="font-mono text-xs text-slate-900">{value}</div>
    </div>
  )
}