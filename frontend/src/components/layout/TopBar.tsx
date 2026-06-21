import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { LogOut, User as UserIcon, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

export default function TopBar() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">ClearPath RAG</h1>
        <p className="text-xs text-slate-500">Azure SQL · Vector + Hybrid Retrieval · GPT-4o Generation</p>
      </div>

      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm hover:bg-slate-100"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-700 font-semibold">
            {user?.full_name?.charAt(0).toUpperCase() ?? <UserIcon className="h-4 w-4" />}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-slate-900 leading-tight">{user?.full_name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-56 rounded-md border border-slate-200 bg-white shadow-lg z-50">
            <div className="p-3 border-b border-slate-100">
              <p className="text-sm font-medium text-slate-900">{user?.full_name}</p>
              <p className="text-xs text-slate-500 mb-2">{user?.email}</p>
              <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'}>{user?.role}</Badge>
            </div>
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}