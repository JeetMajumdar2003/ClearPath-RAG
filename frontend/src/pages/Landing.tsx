import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  Brain,
  ChevronDown,
  Database,
  FileText,
  GitBranch,
  HeartPulse,
  Layers,
  LineChart,
  Lock,
  Menu,
  Quote,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Reveal-on-scroll wrapper using IntersectionObserver. */
function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const [shown, setShown] = useState(false)
  // observe the rendered node via ref-less approach
  return (
    <div
      className={`${className} ${shown ? 'animate-fade-up' : 'opacity-0'}`}
      style={{ animationDelay: `${delay}ms` }}
      ref={(node) => {
        if (!node) return
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (e.isIntersecting) {
                setShown(true)
                io.disconnect()
              }
            })
          },
          { threshold: 0.15 }
        )
        io.observe(node)
      }}
    >
      {children}
    </div>
  )
}

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Architecture', href: '#architecture' },
  { label: 'Evidence', href: '#evidence' },
  { label: 'FAQ', href: '#faq' },
]

/* -------------------------------------------------------------------------- */
/*  Navbar                                                                    */
/* -------------------------------------------------------------------------- */

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-slate-200/70 bg-white/80 backdrop-blur-xl shadow-sm'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-600/20">
            <HeartPulse className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            ClearPath<span className="text-teal-600">RAG</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/register">
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/register">Get started</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                      */
/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy pt-32 pb-24 text-white">
      {/* Animated gradient mesh background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-teal-500/30 blur-3xl animate-pulse-glow" />
        <div className="absolute right-0 top-20 h-112 w-md rounded-full bg-teal-400/20 blur-3xl animate-float-slow" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl animate-float" />
      </div>
      {/* Subtle grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-teal-200 backdrop-blur">
            <Sparkles className="h-4 w-4" />
            Retrieval-augmented intelligence for clinical decisions
          </div>

          <h1 className="animate-fade-up reveal-delay-1 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Ground every clinical answer in{' '}
            <span className="bg-linear-to-r from-teal-300 via-teal-200 to-emerald-300 bg-clip-text text-transparent">
              evidence
            </span>
          </h1>

          <p className="animate-fade-up reveal-delay-2 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
            ClearPathRAG unifies semantic search, hybrid retrieval, and
            generative AI on Azure SQL — so clinicians get cited, traceable
            answers in seconds, not minutes.
          </p>

          <div className="animate-fade-up reveal-delay-3 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/register">
                Start exploring
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white sm:w-auto"
            >
              <a href="#how-it-works">See how it works</a>
            </Button>
          </div>

          <div className="animate-fade-in reveal-delay-4 mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-teal-400" /> HIPAA-aligned
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-teal-400" /> Azure AD auth
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Database className="h-4 w-4 text-teal-400" /> Vector-native SQL
            </span>
          </div>
        </div>

        {/* Floating product preview card */}
        <div className="animate-fade-up reveal-delay-5 relative mx-auto mt-16 max-w-4xl">
          <div className="absolute -inset-2 rounded-2xl bg-linear-to-r from-teal-500/30 to-indigo-500/30 blur-2xl" />
          <div className="relative rounded-2xl border border-white/10 bg-slate-900/80 p-2 shadow-2xl backdrop-blur">
            <div className="flex items-center gap-1.5 px-3 py-2">
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-amber-400/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
              <span className="ml-3 text-xs text-slate-400">
                clearpath.rag / console
              </span>
            </div>
            <div className="grid gap-3 rounded-xl bg-slate-950/60 p-4 sm:grid-cols-3">
              <div className="sm:col-span-2 rounded-lg border border-white/5 bg-white/5 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-teal-300">
                  <Sparkles className="h-4 w-4" /> RAG Console
                </div>
                <p className="text-sm text-slate-300">
                  “What are the recommended first-line treatments for
                  community-acquired pneumonia in adults?”
                </p>
                <div className="mt-3 space-y-2">
                  <div className="h-2 w-full rounded bg-white/10" />
                  <div className="h-2 w-5/6 rounded bg-white/10" />
                  <div className="h-2 w-4/6 rounded bg-teal-400/40" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <div className="text-xs text-slate-400">Retrieval</div>
                  <div className="mt-1 text-lg font-semibold text-teal-300">
                    142 ms
                  </div>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/5 p-3">
                  <div className="text-xs text-slate-400">Sources</div>
                  <div className="mt-1 text-lg font-semibold text-teal-300">
                    8 cited
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Trust bar                                                                 */
/* -------------------------------------------------------------------------- */

function TrustBar() {
  const items = [
    'Azure SQL',
    'OpenAI Embeddings',
    'Full-Text Search',
    'Reciprocal Rank Fusion',
    'FastAPI',
    'React 19',
  ]
  return (
    <section className="border-y border-slate-200 bg-white py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-widest text-slate-400">
          Built on an enterprise-grade stack
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {items.map((i) => (
            <span
              key={i}
              className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900"
            >
              {i}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Features                                                                  */
/* -------------------------------------------------------------------------- */

const FEATURES = [
  {
    icon: Search,
    title: 'Hybrid retrieval',
    desc: 'Combines BM25 full-text search with cosine vector similarity, fused via Reciprocal Rank Fusion for the most relevant cases.',
  },
  {
    icon: Brain,
    title: 'Grounded generation',
    desc: 'Answers are generated strictly from retrieved clinical cases — every claim is traceable to its source passage.',
  },
  {
    icon: FileText,
    title: 'Cited evidence',
    desc: 'Each response includes inline citations and similarity scores, so clinicians can verify provenance instantly.',
  },
  {
    icon: Shield,
    title: 'Secure by design',
    desc: 'JWT auth, role-based access, and Azure Key Vault-managed credentials keep PHI protected end to end.',
  },
  {
    icon: LineChart,
    title: 'Observability',
    desc: 'Query logs, latency metrics, and analytics dashboards give full visibility into retrieval quality and usage.',
  },
  {
    icon: Zap,
    title: 'Sub-second answers',
    desc: 'Vector-optimized Azure SQL with columnstore indexes returns ranked results in milliseconds, not minutes.',
  },
]

function Features() {
  return (
    <section id="features" className="bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge variant="default" className="mb-4">
            Capabilities
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Everything you need to trust the answer
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            A complete retrieval-augmented pipeline — from ingestion to cited
            generation — engineered for clinical workloads.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 80}>
              <div className="group h-full rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl hover:shadow-teal-600/5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {f.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  How it works (RAG pipeline)                                               */
/* -------------------------------------------------------------------------- */

const STEPS = [
  {
    icon: Search,
    title: 'Retrieve',
    desc: 'A clinician’s query is embedded and matched against the clinical-case vector store using hybrid BM25 + cosine search.',
  },
  {
    icon: Layers,
    title: 'Fuse & rank',
    desc: 'Reciprocal Rank Fusion merges lexical and semantic results into a single, de-duplicated ranked list of top-k cases.',
  },
  {
    icon: Brain,
    title: 'Generate',
    desc: 'A grounded prompt assembles the top passages, producing a concise answer with inline citations.',
  },
  {
    icon: ShieldCheck,
    title: 'Verify',
    desc: 'Every source is surfaced with similarity scores so the clinician can audit the reasoning trail.',
  },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge variant="default" className="mb-4">
            How it works
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            From question to cited answer in four steps
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            A transparent pipeline where every generated token is anchored to
            retrieved evidence.
          </p>
        </Reveal>

        <div className="relative mt-16">
          {/* connecting line */}
          <div className="absolute left-0 right-0 top-7 hidden h-px bg-linear-to-r from-transparent via-teal-200 to-transparent lg:block" />
          <div className="grid gap-10 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 120} className="relative">
                <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
                  <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-600/25">
                    <s.icon className="h-6 w-6" />
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-teal-700 shadow ring-1 ring-slate-200">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {s.desc}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Architecture                                                              */
/* -------------------------------------------------------------------------- */

const ARCH = [
  {
    icon: Database,
    title: 'Azure SQL — vector store',
    desc: 'Clinical cases, embeddings, and full-text catalogs live in a single managed database with vector indexes.',
  },
  {
    icon: GitBranch,
    title: 'FastAPI backend',
    desc: 'A typed Python API orchestrates retrieval, fusion, and generation, with Alembic migrations and JWT auth.',
  },
  {
    icon: Layers,
    title: 'React 19 frontend',
    desc: 'A responsive SPA with TanStack Query, Radix UI, and Tailwind v4 delivers the console, search, and analytics.',
  },
  {
    icon: Lock,
    title: 'Security & secrets',
    desc: 'Azure Key Vault stores model credentials; RBAC and audit logs enforce least-privilege access.',
  },
]

function Architecture() {
  return (
    <section id="architecture" className="relative overflow-hidden bg-navy py-24 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-1/4 top-10 h-72 w-72 rounded-full bg-teal-500/15 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-teal-200">
            Architecture
          </span>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            One platform, end to end
          </h2>
          <p className="mt-4 text-lg text-slate-300">
            A layered architecture that keeps retrieval, generation, and
            governance in lockstep.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {ARCH.map((a, i) => (
            <Reveal key={a.title} delay={i * 90}>
              <div className="flex h-full gap-5 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-colors hover:border-teal-400/40 hover:bg-white/10">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
                  <a.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{a.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    {a.desc}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Stats                                                                     */
/* -------------------------------------------------------------------------- */

const STATS = [
  { value: '12K+', label: 'Clinical cases indexed' },
  { value: '<200ms', label: 'Median retrieval latency' },
  { value: '8', label: 'Avg. cited sources per answer' },
  { value: '99.9%', label: 'Platform uptime target' },
]

function Stats() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 rounded-3xl border border-slate-200 bg-slate-50 p-10 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 80} className="text-center">
              <div className="bg-linear-to-br from-teal-600 to-teal-800 bg-clip-text text-4xl font-bold text-transparent sm:text-5xl">
                {s.value}
              </div>
              <div className="mt-2 text-sm font-medium text-slate-600">
                {s.label}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Testimonials                                                              */
/* -------------------------------------------------------------------------- */

const TESTIMONIALS = [
  {
    quote:
      'ClearPathRAG cut our literature review time from hours to seconds — and every answer links back to the source case.',
    name: 'Dr. Lena Ortiz',
    role: 'Attending Physician, Internal Medicine',
  },
  {
    quote:
      'The hybrid retrieval is noticeably sharper than pure vector search. RRF fusion surfaces cases we’d have missed.',
    name: 'Marcus Chen',
    role: 'Clinical Data Scientist',
  },
  {
    quote:
      'Having citations inline means I can trust the output and verify it in one click. That’s the bar for clinical AI.',
    name: 'Dr. Priya Nair',
    role: 'Residency Program Director',
  },
]

function Testimonials() {
  return (
    <section id="evidence" className="bg-slate-50 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <Badge variant="default" className="mb-4">
            Evidence
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Trusted by clinical teams
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <figure className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <Quote className="h-8 w-8 text-teal-200" />
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700">
                    {t.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {t.name}
                    </div>
                    <div className="text-xs text-slate-500">{t.role}</div>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  FAQ                                                                       */
/* -------------------------------------------------------------------------- */

const FAQS = [
  {
    q: 'What is retrieval-augmented generation (RAG)?',
    a: 'RAG combines a search step over your knowledge base with a generative model. Instead of relying on a model’s parametric memory, ClearPathRAG retrieves relevant clinical cases first, then generates an answer grounded strictly in those passages.',
  },
  {
    q: 'How are answers kept traceable?',
    a: 'Every generated response includes inline citations pointing to the retrieved source cases, along with similarity scores. You can inspect each source in the Search Explorer to verify provenance.',
  },
  {
    q: 'Is my data secure?',
    a: 'Yes. Authentication is handled via JWT with role-based access control, model credentials are stored in Azure Key Vault, and all data remains within your Azure SQL boundary.',
  },
  {
    q: 'Can I bring my own clinical cases?',
    a: 'Absolutely. The ingestion pipeline accepts CSV/structured case data, generates embeddings via the configured external model, and indexes them for hybrid search.',
  },
  {
    q: 'What makes retrieval “hybrid”?',
    a: 'Hybrid search blends BM25 full-text ranking with cosine vector similarity. Reciprocal Rank Fusion (RRF) then merges the two ranked lists into a single, de-duplicated result set that captures both lexical and semantic relevance.',
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-200">
      <button
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-base font-medium text-slate-900">{q}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-teal-600 transition-transform duration-300 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ${
          open ? 'grid-rows-[1fr] pb-5' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-sm leading-relaxed text-slate-600">{a}</p>
        </div>
      </div>
    </div>
  )
}

function Faq() {
  return (
    <section id="faq" className="bg-white py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <Badge variant="default" className="mb-4">
            FAQ
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Questions, answered
          </h2>
        </Reveal>
        <div className="mt-12">
          {FAQS.map((f) => (
            <FaqItem key={f.q} {...f} />
          ))}
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  CTA                                                                       */
/* -------------------------------------------------------------------------- */

function Cta() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-teal-600 via-teal-700 to-navy px-8 py-16 text-center shadow-2xl sm:px-16">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-10 -left-10 h-64 w-64 rounded-full bg-teal-300/20 blur-3xl" />
            </div>
            <div className="relative">
              <Target className="mx-auto h-10 w-10 text-teal-200" />
              <h2 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Bring traceable AI to your clinical workflow
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-teal-50">
                Create an account, explore the RAG console, and see how
                grounded generation transforms case review.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  className="w-full bg-white text-teal-700 hover:bg-teal-50 sm:w-auto"
                >
                  <Link to="/register">
                    Create free account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto"
                >
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Footer                                                                    */
/* -------------------------------------------------------------------------- */

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 to-teal-700 text-white">
                <HeartPulse className="h-5 w-5" />
              </span>
              <span className="text-lg font-semibold text-slate-900">
                ClearPath<span className="text-teal-600">RAG</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm text-slate-600">
              Retrieval-augmented intelligence for clinical decisions. Grounded,
              cited, and traceable — built on Azure SQL.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Product</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li><a href="#features" className="hover:text-teal-700">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-teal-700">How it works</a></li>
              <li><a href="#architecture" className="hover:text-teal-700">Architecture</a></li>
              <li><Link to="/register" className="hover:text-teal-700">Get started</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Resources</h4>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li><a href="#faq" className="hover:text-teal-700">FAQ</a></li>
              <li><Link to="/login" className="hover:text-teal-700">Sign in</Link></li>
              <li><a href="#evidence" className="hover:text-teal-700">Evidence</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-6 sm:flex-row">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} ClearPathRAG. Built for clinical decision support.
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-teal-600" /> HIPAA-aligned
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-teal-600" /> SOC2-ready
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <Hero />
        <TrustBar />
        <Features />
        <HowItWorks />
        <Architecture />
        <Stats />
        <Testimonials />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  )
}
