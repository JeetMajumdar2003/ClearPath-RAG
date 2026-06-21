import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Stethoscope,
  Search,
  ScrollText,
  BarChart3,
  Settings,
  HeartPulse,
  MessageSquare,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const items: NavItem[] = [
  { to: '/app/chat', label: 'Ask ClearPath', icon: MessageSquare },
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/rag', label: 'RAG Console', icon: Stethoscope },
  { to: '/app/search', label: 'Search Explorer', icon: Search },
  { to: '/app/logs', label: 'Query Logs', icon: ScrollText },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/settings', label: 'Settings', icon: Settings, adminOnly: true },
]

export default function Sidebar() {
  const { user } = useAuth()
  const filtered = items.filter((i) => !i.adminOnly || user?.role === 'admin')

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-navy text-slate-100">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-700/40">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300">
          <HeartPulse className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">ClearPath</p>
          <p className="text-[11px] uppercase tracking-wider text-slate-400">RAG Platform</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        <ul className="space-y-1">
          {filtered.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-teal-500/15 text-teal-200 border-l-2 border-teal-400 pl-2.5'
                      : 'text-slate-300 hover:bg-slate-700/40 hover:text-white'
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-slate-700/40 p-4 text-xs text-slate-400">
        <p className="font-mono">v1.0.0</p>
        <p className="mt-1">SQL AI Workshop · Clinical RAG</p>
      </div>
    </aside>
  )
}