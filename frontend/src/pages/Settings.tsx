import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, ShieldCheck, UserCog } from 'lucide-react'
import api from '@/lib/api'
import type { RagConfigItem, RagConfigUpdate } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'

const CONFIG_LABELS: Record<string, { label: string; description: string }> = {
  top_n: {
    label: 'Default Top N',
    description: 'How many cases to retrieve per RAG / hybrid query.',
  },
  embedding_type: {
    label: 'Default embedding',
    description: 'Which precomputed embedding column to use (FullCase / DiagnosisOnly / …).',
  },
  vector_weight: {
    label: 'RRF vector weight',
    description: 'Weight applied to the vector ranking in hybrid search.',
  },
  keyword_weight: {
    label: 'RRF keyword weight',
    description: 'Weight applied to the keyword ranking in hybrid search.',
  },
  rrf_k: {
    label: 'RRF k',
    description: 'Smoothing constant for Reciprocal Rank Fusion.',
  },
}

export default function SettingsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const configQuery = useQuery<RagConfigItem[]>({
    queryKey: ['rag', 'config'],
    queryFn: async () => (await api.get<RagConfigItem[]>('/api/v1/rag/config')).data,
  })

  const [draft, setDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    if (configQuery.data) {
      setDraft(Object.fromEntries(configQuery.data.map((c) => [c.key, c.value])))
    }
  }, [configQuery.data])

  const update = useMutation({
    mutationFn: async (payload: RagConfigUpdate) =>
      (await api.put<RagConfigItem[]>('/api/v1/rag/config', payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rag', 'config'] }),
  })

  const isAdmin = user?.role === 'admin'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your profile and RAG defaults. Configuration changes are limited to administrators.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCog className="h-4 w-4 text-slate-400" />
              <CardTitle>Profile</CardTitle>
            </div>
            <CardDescription>Your account information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="Name" value={user?.full_name ?? '—'} />
            <Row label="Email" value={user?.email ?? '—'} />
            <Row
              label="Role"
              value={<Badge variant={isAdmin ? 'default' : 'secondary'}>{user?.role ?? '—'}</Badge>}
            />
            <Row
              label="Member since"
              value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-slate-400" />
                  <CardTitle>RAG defaults</CardTitle>
                </div>
                <CardDescription>
                  {isAdmin
                    ? 'Defaults applied to new RAG queries.'
                    : 'Read-only — admin role required to change.'}
                </CardDescription>
              </div>
              {isAdmin && (
                <Button
                  size="sm"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({
                      top_n: Number(draft.top_n) || undefined,
                      embedding_type: draft.embedding_type,
                      vector_weight: Number(draft.vector_weight),
                      keyword_weight: Number(draft.keyword_weight),
                      rrf_k: Number(draft.rrf_k),
                    })
                  }
                >
                  {update.isPending ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {configQuery.isLoading ? (
              <div className="flex h-32 items-center justify-center"><Spinner /></div>
            ) : (
              Object.keys(CONFIG_LABELS).map((key) => {
                const meta = CONFIG_LABELS[key]
                const value = draft[key] ?? ''
                return (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={key}>{meta.label}</Label>
                    {key === 'embedding_type' ? (
                      <Select
                        id={key}
                        value={value}
                        disabled={!isAdmin}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                      >
                        <option value="FullCase">FullCase</option>
                        <option value="DiagnosisOnly">DiagnosisOnly</option>
                        <option value="ChiefComplaintOnly">ChiefComplaintOnly</option>
                      </Select>
                    ) : (
                      <Input
                        id={key}
                        type="number"
                        step={key.includes('weight') ? '0.05' : '1'}
                        value={value}
                        disabled={!isAdmin}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                      />
                    )}
                    <p className="text-xs text-slate-500">{meta.description}</p>
                  </div>
                )
              })
            )}

            {update.isError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {(update.error as Error)?.message ?? 'Failed to update config'}
              </div>
            )}
            {update.isSuccess && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Settings updated successfully.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  )
}