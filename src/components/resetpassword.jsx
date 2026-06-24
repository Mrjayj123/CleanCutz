import React, { useState, useEffect } from 'react'
import { apiJson } from '../lib/api'

export default function ResetPasswordScreen({ onBackToLogin }) {
  const [token, setToken] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  // Pull ?token=... from the URL the user arrived from (the link in the email)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get('token') || '')
  }, [])

  const handleSubmit = async () => {
    if (busy) return

    if (!token) {
      setError('This reset link is missing its token. Request a new one.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      setSuccess('')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      setSuccess('')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      const data = await apiJson('/api/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword }
      })
      setSuccess(data.message || 'Password updated. You can now log in.')
    } catch (e) {
      setError(e.message || 'Failed to reset password')
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

          <p className="auth-subtitle">Choose a new password for your account.</p>

          {!success && (
            <>
              <input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />

              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={handleKeyDown}
              />

              <button className="btn-primary" onClick={handleSubmit} disabled={busy}>
                {busy ? 'Updating...' : 'Update password'}
              </button>
            </>
          )}

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