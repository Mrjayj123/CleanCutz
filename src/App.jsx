import { useState } from 'react'
import { AuthProvider, useAuth } from '../AuthContext.jsx'
import LoginScreen from './components/LoginScreen.jsx'
import ForgotPasswordScreen from './components/forgotpassword.jsx'
import ResetPasswordScreen from './components/resetpassword.jsx'
import ThemeToggle from './components/ThemeToggle.jsx'
import StudioEditor from './components/Studio.jsx'
import SettingsPage from './components/SettingsPage.jsx'



function Studio() {
  const { user, logout } = useAuth()
  const [page, setPage] = useState('studio')


  // Import and render the existing editor experience.
  // The previously-rendered blank screen was caused by rendering only <VideoHistory />.
  return (
    <div className="app-layout">
      <div className="mesh-gradient" aria-hidden="true" />

      <nav className="navbar">
        <div className="logo">
          Clean<span>Cutz</span>
        </div>
        <div className="navbar-actions">
          <span className="navbar-greeting">Hi, {user.name}</span>
          <ThemeToggle />
          <button
            type="button"
            className="btn-outline"
            onClick={() => setPage('settings')}
            style={{ padding: '8px 12px', fontSize: '0.85rem' }}
          >
            Settings
          </button>
          <button type="button" className="navbar-logout" onClick={logout}>
            Log out
          </button>
        </div>

      </nav>

      {page === 'settings' ? (
        <SettingsPage onBack={() => setPage('studio')} />
      ) : (
        <StudioEditor />
      )}

    </div>
  )
}


function AppShell() {
  const { isAuthenticated, loading, loginWithToken, logout } = useAuth()


  // Simple screen router for the logged-out flow: 'login' | 'forgot' | 'reset'
  // Starts on 'reset' automatically if the URL has a reset token in it
  // (i.e. the user clicked the link from their email).
  const [authScreen, setAuthScreen] = useState(() => {
    const hasResetToken = new URLSearchParams(window.location.search).has('token')
    return hasResetToken ? 'reset' : 'login'
  })

  if (loading) {
    return (
      <div className="overlay">
        <p className="loading">LOADING</p>
      </div>
    )
  }

  if (isAuthenticated) return <Studio />

  if (authScreen === 'forgot') {
    return <ForgotPasswordScreen onBackToLogin={() => setAuthScreen('login')} />
  }

  if (authScreen === 'reset') {
    return <ResetPasswordScreen onBackToLogin={() => setAuthScreen('login')} />
  }

  return (
    <LoginScreen
      onLogin={({ token }) => loginWithToken(token)}
      onForgotPassword={() => setAuthScreen('forgot')}
    />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}