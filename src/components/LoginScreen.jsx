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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin()
    }
  }

  return (
    <div className="overlay">
      <div className="glass auth-card">
        <h1 className="logo-text">Clean <span>Cutz</span></h1>
        <p>A One of a kind Video Editing Experience</p>
        
        <input 
          type="text" 
          id="username" 
          placeholder="Editor Name"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        
        <button className="btn-primary" onClick={handleLogin}>
          Launch Studio
        </button>
        
        {error && (
          <p className="error" style={{ color: '#ff4b4b', marginTop: '15px', fontSize: '0.8rem' }}>
            Invalid credentials
          </p>
        )}
      </div>
    </div>
  )
}
