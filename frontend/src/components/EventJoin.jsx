import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const API = import.meta.env.VITE_API_URL

export default function EventJoin() {
  const [token, setToken]       = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [event, setEvent]       = useState(null)
  const [section, setSection]   = useState('')
  const scannerRef = useRef(null)
  const navigate   = useNavigate()

  const joinEvent = async (qrToken) => {
    setError('')
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/events/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Could not join event')
      setEvent(data)
      setSection(data.event.sections[0])
    } catch {
      setError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }

  const startScanning = async () => {
    setScanning(true)
    setError('')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          scanner.stop()
          setScanning(false)
          // Extract token from URL or use raw value
          const url = (() => { try { return new URL(decodedText) } catch { return null } })()
          const extracted = url ? url.searchParams.get('token') : decodedText
          setToken(extracted || decodedText)
          joinEvent(extracted || decodedText)
        },
        () => {}
      )
    } catch {
      setScanning(false)
      setError('Camera not available — enter code manually')
    }
  }

  const stopScanning = () => {
    scannerRef.current?.stop?.()
    setScanning(false)
  }

  const handleEnterChat = () => {
    if (!event || !section) return
    sessionStorage.setItem('attendeeSession', JSON.stringify({
      ...event,
      section,
      token: event.token,
    }))
    navigate('/chat')
  }

  // Section selection screen
  if (event) {
    return (
      <div className="page-center">
        <div className="auth-page">
          <div className="card fade-in">
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <span style={{ fontSize: 42 }}>✅</span>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 12, color: 'var(--text-primary)' }}>
                {event.event.name}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>
                📍 {event.event.location}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                Your anonymous ID: <strong style={{ color: 'var(--accent)' }}>{event.anonymousId}</strong>
              </p>
            </div>

            <label className="input-label">Select Your Section</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10, marginBottom: 20 }}>
              {event.event.sections.map(s => (
                <button key={s} onClick={() => setSection(s)} className="btn btn-ghost"
                  style={{ justifyContent: 'center', borderColor: section === s ? 'var(--accent)' : undefined,
                           background: section === s ? 'var(--accent-dim)' : undefined,
                           color: section === s ? 'var(--accent)' : undefined }}>
                  {s}
                </button>
              ))}
            </div>

            <button className="btn btn-primary btn-full" onClick={handleEnterChat}>
              Enter Section {section} →
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
              Your identity is completely anonymous
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-center">
      <div className="auth-page">
        <div className="auth-logo-area">
          <span className="auth-logo-icon">🛡️</span>
          <h1 className="auth-title">Join Event</h1>
          <p className="auth-subtitle">Scan the QR code or enter your event code</p>
        </div>

        {scanning ? (
          <div className="card" style={{ marginBottom: 16 }}>
            <div id="qr-reader" style={{ width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden' }} />
            <button className="btn btn-ghost btn-full" style={{ marginTop: 12 }} onClick={stopScanning}>
              ✕ Cancel Scan
            </button>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 16 }}>
            <button className="btn btn-ghost btn-full" onClick={startScanning} style={{ marginBottom: 16 }}>
              📷 Scan QR Code
            </button>

            <div className="auth-divider">or enter code manually</div>

            <div style={{ marginTop: 16 }}>
              <label className="input-label">Event Code</label>
              <input className="input" value={token} onChange={e => setToken(e.target.value.trim())}
                placeholder="Paste event token here" style={{ letterSpacing: 1, fontFamily: 'monospace' }} />
            </div>

            {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}

            <button className="btn btn-primary btn-full" style={{ marginTop: 16 }}
              onClick={() => joinEvent(token)} disabled={!token || loading}>
              {loading ? <span className="spinner" /> : '🔐'} {loading ? 'Joining…' : 'Join Event'}
            </button>
          </div>
        )}

        <div className="auth-divider" style={{ margin: '16px 0' }}>organizer?</div>
        <a href="/auth" className="btn btn-ghost btn-full" style={{ display: 'flex', justifyContent: 'center' }}>
          Organizer Login →
        </a>
      </div>
    </div>
  )
}
