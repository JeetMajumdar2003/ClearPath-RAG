import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/layout/ProtectedRoute'
import AppShell from '@/components/layout/AppShell'
import LandingPage from '@/pages/Landing'
import LoginPage from '@/pages/Login'
import RegisterPage from '@/pages/Register'
import DashboardPage from '@/pages/Dashboard'
import RagConsolePage from '@/pages/RagConsole'
import ChatPage from '@/pages/Chat'
import SearchExplorerPage from '@/pages/SearchExplorer'
import LogsPage from '@/pages/Logs'
import AnalyticsPage from '@/pages/Analytics'
import SettingsPage from '@/pages/Settings'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="rag" element={<RagConsolePage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="search" element={<SearchExplorerPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}