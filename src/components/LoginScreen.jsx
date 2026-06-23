import React, { useState } from 'react'

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('')
  const [error, setError] = useState(false)

  const handleLogin = () => {
    if (username.trim() !== '') {
      onLogin(username)
      setError(false)
    } else {
      setError(true)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div className="overlay">
      <div className="glass auth-card">
        <h1 className="logo-text">Clean <span>Cutz</span></h1>
        <p className="auth-subtitle">
          Upload, trim, and save video clips with precision
        </p>

        <input
          type="text"
          id="username"
          placeholder="Enter your name to begin"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />

        <button className="btn-primary" onClick={handleLogin}>
          🎬 Launch Studio
        </button>

        {error && (
          <div className="status-msg error" style={{ marginTop: '16px' }}>
            Please enter a name to continue
          </div>
        )}
      </div>
    </div>
  )
}
