import React, { useState } from 'react'
import { SERVER, apiJson } from '../lib/api'

export default function LoginScreen({ onLogin, onForgotPassword }) {
  const [mode, setMode] = useState('login') // login | register
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [identifier, setIdentifier] = useState('') // login only: username OR email
  const [password, setPassword] = useState('')
  const [success, setSuccess] = useState('')

  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const validate = () => {

    if (mode === 'register') {
      if (!username.trim()) return 'Username is required'
      if (!email.trim() || !email.includes('@')) return 'Valid email is required'
    } else {
      // Login: backend identifies by email, but we let the user type either
      // a username or an email into one field, Instagram-style.
      if (!identifier.trim()) return 'Username or email is required'
      if (!identifier.includes('@')) return 'Log in with your email address'
    }
    if (!password || password.length < 1) return 'Password is required'
    return ''
  }


  const handleSubmit = async () => {
    if (busy) return
    const msg = validate()
    if (msg) {
      setError(msg)
      setSuccess('')
      return
    }


    setBusy(true)
    setError('')
    setSuccess('')

    try {
      if (mode === 'login') {
        const data = await apiJson('/api/auth/login', {
          method: 'POST',
          body: { email: identifier.trim(), password }
        })
        onLogin({ token: data.token })
      } else {
        const data = await apiJson('/api/auth/register', {
          method: 'POST',
          body: { name: username.trim(), email: email.trim(), password }
        })

        // Local notification (email sending is not configured in this repo)
        setSuccess(`Signed up successfully for ${email.trim()}!`)
        // prompt user: allow immediate login after signup
        onLogin({ token: data.token })
      }
    } catch (e) {
      setError(e.message || 'Authentication failed')
      setSuccess('')
    } finally {
      setBusy(false)
    }
  }


  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setSuccess('')
  }

  return (
    <div className="overlay ig-overlay">
      <div className="ig-stack">
        <div className="glass auth-card ig-card">
          <h1 className="logo-text">
            Clean <span>Cutz</span>
          </h1>

          <p className="auth-subtitle">
            {mode === 'login' ? 'Log in to continue editing.' : 'Sign up to start trimming.'}
          </p>

          {mode === 'login' ? (
            <>
              <input
                type="text"
                id="identifier"
                placeholder="Username or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />

              <input
                type="password"
                id="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
              />

              <button
                type="button"
                className="ig-forgot-link"
                onClick={onForgotPassword}
              >
                Forgot password?
              </button>
            </>
          ) : (
            <>
              <input
                type="text"
                id="username"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
              />

              <input
                type="email"
                id="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
              />

              <input
                type="password"
                id="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </>
          )}

          <button className="btn-primary" onClick={handleSubmit} disabled={busy}>
            {busy ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Sign up'}
          </button>

          {(error || success) && (
            <div style={{ marginTop: '12px' }}>
              {success && (
                <div className="status-msg success" style={{ marginTop: '0' }}>
                  {success}
                </div>
              )}
              {error && (
                <div className="status-msg error" style={{ marginTop: success ? '8px' : '0' }}>
                  {error}
                </div>
              )}
            </div>
          )}

          <div className="ig-divider">
            <span />
            <p>OR</p>
            <span />
          </div>

          {mode === 'login' ? (
            <button
              type="button"
              className="ig-link"
              onClick={() => switchMode('register')}
            >
              Create new account
            </button>
          ) : (
            <button
              type="button"
              className="ig-link"
              onClick={() => switchMode('login')}
            >
              Back to login
            </button>
          )}
        </div>

        <div className="glass ig-footer-card">
          {mode === 'login' ? (
            <span>
              Don&apos;t have an account?{' '}
              <button type="button" className="ig-footer-action" onClick={() => switchMode('register')}>
                Sign up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button type="button" className="ig-footer-action" onClick={() => switchMode('login')}>
                Log in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  )
}