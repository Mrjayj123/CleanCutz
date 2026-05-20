import React, { useState } from 'react'
import LoginScreen from './components/LoginScreen'
import Studio from './components/Studio'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const handleLogin = (username) => {
    setIsLoggedIn(true)
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
  }

  return (
    <div className="app">
      <div className="mesh-gradient"></div>
      {!isLoggedIn ? (
        <LoginScreen onLogin={handleLogin} />
      ) : (
        <Studio onLogout={handleLogout} />
      )}
    </div>
  )
}

export default App
