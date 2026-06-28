import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function AppShell() {
  const location = useLocation()
  const isChatPage = location.pathname === '/app/chat'

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className={`flex-1 overflow-y-auto scrollbar-thin ${isChatPage ? '' : 'p-6'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}