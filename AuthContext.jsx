import { createContext, useContext, useEffect, useState, useCallback } from 'react'

const AuthContext = createContext(null)

const API_BASE = 'http://localhost:3001'
const TOKEN_KEY = 'cleancutz_token'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Apply theme to <body> as a data attribute the CSS can key off of
  useEffect(() => {
    document.body.dataset.theme = user?.theme || 'dark'
  }, [user?.theme])

  // On mount (or token change), verify the token and load the user
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Session expired')
        return res.json()
      })
      .then(data => setUser(data.user))
      .catch(() => {
        sessionStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  const register = useCallback(async ({ name, email, password }) => {
    setError(null)
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Registration failed')
      return false
    }

    sessionStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
    return true
  }, [])

  const login = useCallback(async ({ email, password }) => {
    setError(null)
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Login failed')
      return false
    }

    sessionStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
    return true
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  // For screens (like LoginScreen) that call the API themselves via apiJson
  // and just hand back a token, rather than going through login() above.
  // Fetches /me to populate the user, same as the mount-time effect does.
  const loginWithToken = useCallback(async (newToken) => {
    setError(null)
    sessionStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${newToken}` }
      })
      if (!res.ok) throw new Error('Could not load account')
      const data = await res.json()
      setUser(data.user)
      return true
    } catch (e) {
      sessionStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
      setError(e.message)
      return false
    }
  }, [])

  const setTheme = useCallback(async (theme) => {
    if (!token) return
    // Optimistic update so the toggle feels instant
    setUser(prev => prev ? { ...prev, theme } : prev)

    const res = await fetch(`${API_BASE}/api/auth/theme`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ theme })
    })

    if (res.ok) {
      const data = await res.json()
      setUser(data.user)
    }
  }, [token])

  // Helper for other API calls (videos, upload, trim, etc.) to attach the token
  const authHeader = useCallback(() => (
    token ? { Authorization: `Bearer ${token}` } : {}
  ), [token])

  const value = {
    token,
    user,
    loading,
    error,
    isAuthenticated: Boolean(token && user),
    register,
    login,
    loginWithToken,
    logout,
    setTheme,
    authHeader,
    apiBase: API_BASE
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}