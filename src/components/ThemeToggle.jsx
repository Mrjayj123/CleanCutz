import React from 'react'
import { useAuth } from '../../AuthContext.jsx'

export default function ThemeToggle() {
  const { user, setTheme } = useAuth()

  const current = user?.theme || 'dark'
  const next = current === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {next === 'light' ? '☀️' : '🌙'}
    </button>
  )
}

