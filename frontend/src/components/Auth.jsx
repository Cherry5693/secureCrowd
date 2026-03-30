import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'

const API = import.meta.env.VITE_API_URL

export default function Auth() {
  const [mode, setMode]       = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) {
      return setError('Username and password are required')
    }
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/users/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Authentication failed')
      localStorage.setItem('organizerUser', JSON.stringify({ ...data.user, token: data.token }))
      navigate('/organizer')
    } catch {
      setError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-center">
      <div className="auth-page">
        <div className="auth-logo-area">
          <span className="auth-logo-icon">🛡️</span>
          <h1 className="auth-title">SecureCrowd</h1>
          <p className="auth-subtitle">Real-Time Emergency Communication System</p>
        </div>

        <div className="card">
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
            {mode === 'login' ? 'Organizer Login' : 'Create Organizer Account'}
          </h2>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div>
              <label className="input-label">Username</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="Enter username" autoComplete="username" />
            </div>
            <div>
              <label className="input-label">Password</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Enter password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>

            {error && <div className="error-msg">{error}</div>}

            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Please wait…' : (mode === 'login' ? 'Login as Organizer' : 'Create Account')}
            </button>
          </form>

          <p className="auth-toggle-link" style={{ marginTop: 16 }}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}>
              {mode === 'login' ? 'Register' : 'Login'}
            </button>
          </p>
        </div>

        <div className="auth-divider" style={{ margin: '20px 0' }}>or</div>

        <div className="card" style={{ textAlign: 'center', padding: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>
            Attending an event?
          </p>
          <a href="/join" className="btn btn-ghost btn-full" style={{ justifyContent: 'center', display: 'flex' }}>
            📷 Scan QR / Enter Event Code
          </a>
        </div>
      </div>
    </div>
  )
}
