import React, { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext.jsx'

export default function SettingsPage({ onBack }) {
  const { user, setTheme } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const current = user?.theme || 'dark'

  useEffect(() => {
    setErr('')
  }, [current])

  const applyTheme = async (next) => {
    if (busy) return
    setBusy(true)
    setErr('')
    try {
      await setTheme(next)
    } catch (e) {
      setErr(e?.message || 'Failed to update theme')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay" style={{ position: 'relative', inset: 'auto', padding: 40, zIndex: 0 }}>
      <div className="mesh-gradient" aria-hidden="true" />
      <div className="glass auth-card" style={{ maxWidth: 720, textAlign: 'left' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h1 className="logo-text" style={{ fontSize: '2rem', marginBottom: 6 }}>
              Settings
            </h1>
            <p className="auth-subtitle" style={{ marginBottom: 0 }}>
              Customize your studio experience.
            </p>
          </div>
          <button type="button" className="btn-outline" onClick={onBack}>
            ← Back
          </button>
        </div>

        <div style={{ marginTop: 24 }}>
          <div style={{ color: 'var(--text-dim)', fontWeight: 700, fontSize: '0.85rem', marginBottom: 10 }}>
            Appearance
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-outline"
              onClick={() => applyTheme('dark')}
              disabled={busy || current === 'dark'}
            >
              🌙 Dark
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => applyTheme('light')}
              disabled={busy || current === 'light'}
            >
              ☀️ Light
            </button>
          </div>

          {err && <div className="status-msg error" style={{ marginTop: 12 }}>{err}</div>}
        </div>

        <div style={{ marginTop: 20, color: 'var(--text-dim)', fontSize: '0.85rem', lineHeight: 1.6 }}>
          <div><b>Tip:</b> Imported videos are stored locally under your account so different users can’t access each other’s files.</div>
          <div style={{ marginTop: 8 }}>
            <b>Trim:</b> You’ll need <code>ffmpeg</code> installed on the server host for trimming to work.
          </div>
        </div>
      </div>
    </div>
  )
}

