import { useState } from 'react'
import { apiFetch } from '../utils/api'
import { QRCode } from 'react-qr-code'

const API = import.meta.env.VITE_API_URL

export default function OrganizerEventCreate({ onCreated }) {
  const [form, setForm] = useState({
    name: '', location: '', sections: 'A,B,C,D',
    startTime: '', endTime: '',
  })

  const [created, setCreated] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
 
  
  const organizer = JSON.parse(localStorage.getItem('organizerUser') || '{}')
  const joinUrl   = created ? `${window.location.origin}/join?token=${created.qrToken}` : ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.name || !form.location || !form.startTime || !form.endTime)
      return setError('All fields are required')

    setLoading(true)
    try {
      const res  = await apiFetch(`${API}/api/events/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${organizer.token}` },
        body: JSON.stringify({
          ...form,
          startTime: form.startTime ? `${form.startTime}:00+05:30` : undefined,
          endTime: form.endTime ? `${form.endTime}:00+05:30` : undefined,
          sections: form.sections.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Failed to create event')
      
      setCreated(data)
      onCreated?.(data)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (created) {
    return (
      <div className="card fade-in" style={{ maxWidth: 520 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 40 }}>✅</span>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 10, color: 'var(--text-primary)' }}>
            Event Created!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 6 }}>{created.name}</p>
        </div>

        {/* QR Code */}
        <div style={{
          background: '#fff', borderRadius: 'var(--radius-md)', padding: 20,
          display: 'flex', justifyContent: 'center', marginBottom: 20,
        }}>
          <QRCode value={joinUrl} size={200} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label className="input-label">Join URL / Token</label>
          <div style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', padding: '10px 14px',
            fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)',
            wordBreak: 'break-all',
          }}>
            {joinUrl}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }}
            onClick={() => { navigator.clipboard.writeText(joinUrl) }}>
            📋 Copy Link
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setCreated(null); setForm({ name:'',location:'',sections:'A,B,C,D',startTime:'',endTime:'' }) }}>
            + New Event
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
        🗓️ Create New Event
      </h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label className="input-label">Event Name</label>
          <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Stadium Concert 2025" />
        </div>
        <div>
          <label className="input-label">Location</label>
          <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            placeholder="e.g. National Stadium, Gate 1" />
        </div>
        <div>
          <label className="input-label">Sections (comma-separated)</label>
          <input className="input" value={form.sections} onChange={e => setForm(f => ({ ...f, sections: e.target.value }))}
            placeholder="A,B,C,D" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label className="input-label">Start Time</label>
            <input className="input" type="datetime-local" value={form.startTime}
              onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">End Time</label>
            <input className="input" type="datetime-local" value={form.endTime}
              onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
          {loading ? <><span className="spinner" /> Creating…</> : '🚀 Create Event & Generate QR'}
        </button>
      </form>
    </div>
  )
}
