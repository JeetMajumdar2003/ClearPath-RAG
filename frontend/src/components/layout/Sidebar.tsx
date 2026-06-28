import { NavLink } from 'react-router-dom'
import { useState } from 'react'
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
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  LogOut,
  HelpCircle,
  Sun,
  Moon,
  User,
  ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

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
  // { to: '/app/settings', label: 'Settings', icon: Settings, adminOnly: true },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const filtered = items.filter((i) => !i.adminOnly || user?.role === 'admin')

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-navy text-slate-100 transition-all duration-300',
        collapsed ? 'md:w-16' : 'md:w-64'
      )}
    >
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-700/40">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">ClearPath</p>
              <p className="text-[11px] uppercase tracking-wider text-slate-400">RAG Platform</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            'flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-slate-700/40 hover:text-white transition-colors',
            collapsed && 'mx-auto'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4 scrollbar-thin">
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
                      : 'text-slate-300 hover:bg-slate-700/40 hover:text-white',
                    collapsed && 'justify-center px-2'
                  )
                }
                title={collapsed ? label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-slate-700/40 p-1">
        {collapsed ? (
          <div className="flex flex-col items-center gap-3 p-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-teal-700 font-semibold text-xs hover:ring-2 hover:ring-teal-300"
                title="Profile menu"
              >
                {user?.full_name?.charAt(0).toUpperCase() ?? <UserIcon className="h-4 w-4" />}
              </button>
              {profileOpen && (
                <div className="absolute bottom-full left-0 right-0 -ml-2.5 mb-2 w-60 rounded-lg border border-slate-600 bg-slate-800 shadow-xl z-50">
                  <div className="p-2 space-y-1">
                    <button type="button" onClick={() => { setProfileOpen(false); navigate('/app/profile') }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"><User className="h-4 w-4" />Profile</button>
                    <button type="button" onClick={() => { setProfileOpen(false); navigate('/app/settings') }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"><Settings className="h-4 w-4" />Settings</button>
                    <button type="button" onClick={() => setProfileOpen(false)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"><HelpCircle className="h-4 w-4" />Help</button>
                    <button type="button" onClick={() => setProfileOpen(false)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"><Sun className="h-4 w-4" />Theme</button>
                    <hr className="border-slate-600" />
                    <button type="button" onClick={() => { logout(); navigate('/login'); setProfileOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-300 hover:bg-slate-700"><LogOut className="h-4 w-4" />Sign out</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative">
            <button type="button" onClick={() => setProfileOpen((v) => !v)} className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-slate-700/40 transition-colors">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 font-semibold text-xs">{user?.full_name?.charAt(0).toUpperCase() ?? <UserIcon className="h-4 w-4" />}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-100 truncate">{user?.full_name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>
            {profileOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-slate-600 bg-slate-800 shadow-xl z-50">
                <div className="p-2 space-y-1">
                  <button type="button" onClick={() => { setProfileOpen(false); navigate('/app/profile') }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"><User className="h-4 w-4" />Profile</button>
                  <button type="button" onClick={() => { setProfileOpen(false); navigate('/app/settings') }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"><Settings className="h-4 w-4" />Settings</button>
                  <button type="button" onClick={() => setProfileOpen(false)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"><HelpCircle className="h-4 w-4" />Help</button>
                  <button type="button" onClick={() => setProfileOpen(false)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"><Sun className="h-4 w-4" />Theme</button>
                  <hr className="border-slate-600" />
                  <button type="button" onClick={() => { logout(); navigate('/login'); setProfileOpen(false); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-300 hover:bg-slate-700"><LogOut className="h-4 w-4" />Sign out</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* {!collapsed && (
        <div className="border-t border-slate-700/40 p-1 text-[11px] text-slate-400 flex flex-row items-center justify-between gap-2">
          <p className="mt-1">SQL AI Workshop · Clinical RAG</p>
          <p className="font-mono">v1.0.0</p>
        </div>
      )} */}
    </aside>
  )
}