import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import api from '@/lib/api'
import type { User } from '@/lib/types'

interface AuthContextValue {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const TOKEN_KEY = 'cp_token'
const USER_KEY = 'cp_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  })
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState<boolean>(!!localStorage.getItem(TOKEN_KEY))

  const persist = useCallback((nextToken: string | null, nextUser: User | null) => {
    if (nextToken) localStorage.setItem(TOKEN_KEY, nextToken)
    else localStorage.removeItem(TOKEN_KEY)
    if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    else localStorage.removeItem(USER_KEY)
    setToken(nextToken)
    setUser(nextUser)
  }, [])

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const { data } = await api.get<User>('/api/v1/auth/me')
      localStorage.setItem(USER_KEY, JSON.stringify(data))
      setUser(data)
    } catch {
      persist(null, null)
    } finally {
      setLoading(false)
    }
  }, [token, persist])

  useEffect(() => {
    if (token) {
      refresh()
    } else {
      setLoading(false)
    }
  }, [token, refresh])

  const login = useCallback(
    async (email: string, password: string) => {
      const body = new URLSearchParams()
      body.append('username', email)
      body.append('password', password)
      const { data } = await api.post<{ access_token: string; user: User }>(
        '/api/v1/auth/login',
        body,
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      )
      persist(data.access_token, data.user)
    },
    [persist]
  )

  const register = useCallback(
    async (email: string, password: string, fullName: string) => {
      await api.post<User>('/api/v1/auth/register', {
        email,
        password,
        full_name: fullName,
      })
      await login(email, password)
    },
    [login]
  )

  const logout = useCallback(() => {
    persist(null, null)
  }, [persist])

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, loading, login, register, logout, refresh }),
    [user, token, loading, login, register, logout, refresh]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}