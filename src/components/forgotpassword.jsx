import React, { useState } from 'react'
import { apiJson } from '../lib/api'

export default function ForgotPasswordScreen({ onBackToLogin }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  const handleSubmit = async () => {
    if (busy) return

    if (!email.trim() || !email.includes('@')) {
      setError('Enter a valid email address')
      setSuccess('')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      // Public endpoint: no auth required
      const data = await apiJson('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim() }
      })

      setSuccess(data.message || 'If an account exists for that email, a reset link has been sent.')
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="overlay ig-overlay">
      <div className="ig-stack">
        <div className="glass auth-card ig-card">
          <h1 className="logo-text">
            Clean <span>Cutz</span>
          </h1>

          <p className="auth-subtitle">
            Enter your email and we'll send you a link to reset your password.
          </p>

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            disabled={Boolean(success)}
          />

          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={busy || Boolean(success)}
          >
            {busy ? 'Sending...' : 'Send reset link'}
          </button>


          {(error || success) && (
            <div style={{ marginTop: '12px' }}>
              {success && <div className="status-msg success">{success}</div>}
              {error && <div className="status-msg error">{error}</div>}
            </div>
          )}

          <div className="ig-divider">
            <span />
            <p>OR</p>
            <span />
          </div>

          <button type="button" className="ig-link" onClick={onBackToLogin}>
            Back to login
          </button>
        </div>
      </div>
    </div>
  )
}