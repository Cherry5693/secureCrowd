import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../App.css'

import toast from "react-hot-toast";

const API = import.meta.env.VITE_API_URL

export default function Auth() {
  const [mode, setMode]       = useState('login') // 'login', 'register', 'verify'
  const [username, setUsername] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [savedUsername, setSavedUsername] = useState('')
  const [registrationToken, setRegistrationToken] = useState(null)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (mode === 'verify') {
      if (!verificationCode.trim()) return setError('Verification code is required')
      setLoading(true)
      try {
        const res = await fetch(`${API}/api/users/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: savedUsername, code: verificationCode, registrationToken }),
        })
        const data = await res.json()
        if (!res.ok) return setError(data.error || 'Verification failed')
        
        localStorage.setItem('organizerUser', JSON.stringify({ ...data.user, token: data.token }))
        navigate(data.user.role === 'security' ? '/security' : '/organizer')
      } catch {
        setError('Network error — check your connection')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!username.trim() || !password.trim() || (mode === 'register' && !email.trim())) {
      return setError('Please fill in all required fields')
    }
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/users/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email: mode === 'register' ? email : undefined }),
      })
      const data = await res.json()
      
      if (!res.ok) {
        if (data.requiresVerification) {
          setSavedUsername(data.username)
          setRegistrationToken(data.registrationToken || null)
          setMode('verify')
          setError('Please verify your email to continue.')
          return
        }
        return setError(data.error || 'Authentication failed')
      }
      
      if (mode === 'register') {
        setSavedUsername(data.username || username)
        setRegistrationToken(data.registrationToken)
        setMode('verify')
      } else {
        localStorage.setItem('organizerUser', JSON.stringify({ ...data.user, token: data.token }))
        navigate(data.user.role === 'security' ? '/security' : '/organizer')
      }
    } catch {
      setError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    try {
      const res = await fetch(`${API}/api/users/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: savedUsername, registrationToken }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Failed to resend')
      if (data.registrationToken) setRegistrationToken(data.registrationToken)
      alert('Verification code resent!')
    } catch {
      setError('Network error')
    }
  }

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      return setError('Enter your email')
    }

    const toastId = toast.loading("Sending reset link...");

    try {
      const res = await fetch(`${API}/api/users/forgot-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || "Failed to send reset link", { id: toastId });
        return;
      }

      toast.success(data.message, { id: toastId });

      setShowForgot(false);
      setResetEmail('');
      setError('');

    } catch (err) {
      toast.error("Something went wrong", { id: toastId });
      setError('Network error');
    }
  };

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
            {mode === 'verify' ? 'Verify Your Email' : mode === 'login' ? 'Staff Portal Login' : 'Create Organizer Account'}
          </h2>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'verify' ? (
              <div>
                <label className="input-label">6-Digit Code</label>
                <input className="input" style={{ letterSpacing: 4, fontSize: 18, textAlign: 'center' }}
                  value={verificationCode} onChange={e => setVerificationCode(e.target.value)}
                  placeholder="000000" maxLength={6} />
              </div>
            ) : (
              <>
                <div>
                  <label className="input-label">Username</label>
                  <input className="input" value={username} onChange={e => setUsername(e.target.value)}
                    placeholder="Enter username" autoComplete="username" />
                </div>
                {mode === 'register' && (
                  <div>
                    <label className="input-label">Email</label>
                    <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="Enter your email" />
                  </div>
                )}
                <div>
                  <label className="input-label">Password</label>
                  <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                </div>
                {mode === 'login' && (
                  <p style={{ textAlign: 'right', marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={()=>setShowForgot(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#3b82f6',
                        cursor: 'pointer',
                        fontSize: 13
                      }}
                    >
                      Forgot Password?
                    </button>
                  </p>
                )}
              </>
            )}

            {error && <div className="error-msg">{error}</div>}

            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : null}
              {loading ? 'Please wait…' : mode === 'verify' ? 'Verify Account' : mode === 'login' ? 'Login' : 'Create Account'}
            </button>
          </form>

          {mode === 'verify' ? (
             <p className="auth-toggle-link" style={{ marginTop: 16 }}>
               Didn't receive the email? <button type="button" onClick={handleResend}>Resend Code</button>
             </p>
          ) : (
            <p className="auth-toggle-link" style={{ marginTop: 16 }}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
              <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}>
                {mode === 'login' ? 'Register' : 'Login'}
              </button>
            </p>
          )}
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

      {showForgot && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{ marginBottom: 12 }}>Reset Password</h3>

            <input
              className="input"
              type="email"
              placeholder="Enter your registered email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 15 }}>
              <button
                className="btn btn-primary"
                onClick={handleForgotPassword}
              >
                Send Link
              </button>

              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowForgot(false)
                  setResetEmail('')
                  setError('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
