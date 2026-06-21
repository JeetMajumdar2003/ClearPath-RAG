import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { HeartPulse, Shield, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user) {
    const from = (location.state as { from?: string } | null)?.from ?? '/app/dashboard'
    return <Navigate to={from} replace />
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      const from = (location.state as { from?: string } | null)?.from ?? '/app/dashboard'
      navigate(from, { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message.includes('401') ? 'Invalid email or password' : message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-navy text-white p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-br from-teal-900/20 to-slate-900/80" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xl font-semibold">ClearPath RAG</p>
            <p className="text-sm text-slate-400">Clinical decision support platform</p>
          </div>
        </div>

        <div className="relative z-10 space-y-8 max-w-md">
          <h1 className="text-4xl font-bold leading-tight">
            Evidence-based retrieval,
            <br />
            <span className="text-teal-300">grounded in your clinical data.</span>
          </h1>
          <p className="text-slate-300 text-base leading-relaxed">
            Vector search, hybrid RRF retrieval, and GPT-4o generation — all running inside Azure SQL
            Database with full audit logging.
          </p>

          <div className="grid gap-4">
            <Feature icon={<Shield className="h-4 w-4" />} title="Secure by default">
              JWT auth, role-based access, query audit trail
            </Feature>
            <Feature icon={<Sparkles className="h-4 w-4" />} title="RAG, not hallucination">
              Retrieval-augmented generation with cosine-similarity matching
            </Feature>
          </div>
        </div>

        <div className="relative z-10 text-xs text-slate-400">
          Built on the Microsoft SQL AI in a Day workshop · Project ClearPath
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>Sign in to access the ClearPath RAG console.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@hospital.org"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>

              <p className="text-sm text-center text-slate-500">
                Don't have an account?{' '}
                <Link to="/register" className="text-teal-700 hover:underline font-medium">
                  Register
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-teal-500/15 text-teal-300 shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-slate-400">{children}</p>
      </div>
    </div>
  )
}