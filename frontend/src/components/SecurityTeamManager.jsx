import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL

export default function SecurityTeamManager({ organizerToken }) {
  const [guards, setGuards] = useState([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const fetchGuards = async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/users/security`, {
        headers: { Authorization: `Bearer ${organizerToken}` }
      })
      if (r.ok) {
        const data = await r.json()
        setGuards(data)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGuards()
  }, [organizerToken])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!username.trim() || !password.trim()) {
      return setError('Username and password are required')
    }
    setIsCreating(true)
    try {
      const r = await fetch(`${API}/api/users/security`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${organizerToken}` 
        },
        body: JSON.stringify({ username, password })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || 'Failed to create account')
      
      setSuccess(`Account '${data.username}' created successfully`)
      setUsername('')
      setPassword('')
      fetchGuards()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id, guardName) => {
    if (!window.confirm(`Are you sure you want to completely revoke access for '${guardName}'?`)) return
    
    try {
      const r = await fetch(`${API}/api/users/security/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${organizerToken}` }
      })
      if (r.ok) {
        setGuards(prev => prev.filter(g => g._id !== id))
        setSuccess(`Account '${guardName}' permanently deleted`)
        setTimeout(() => setSuccess(''), 3000)
      }
    } catch (err) {
      alert('Failed to delete account')
    }
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>🛡️ Security Team Management</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 14 }}>
            Generate credentials for your crisis response personnel. These accounts access the dedicated Security Dispatch.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        
        {/* Left Side: Creation Form */}
        <div className="card" style={{ flex: '1 1 300px', padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-secondary)' }}>
            + Issue Guard Credentials
          </h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className="input-label">Guard Identifier (Username)</label>
              <input className="input" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. Guard-Alpha" />
            </div>
            <div>
              <label className="input-label">Access Password</label>
              <input className="input" type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter secure password" />
            </div>
            {error && <div className="error-msg">{error}</div>}
            {success && <div style={{ color: 'var(--safe)', fontSize: 13, background: 'var(--safe-dim)', padding: '8px', border: '1px solid var(--safe)', borderRadius: 4 }}>✓ {success}</div>}
            
            <button className="btn btn-primary" type="submit" disabled={isCreating} style={{ marginTop: 8 }}>
              {isCreating ? 'Creating...' : 'Create Account'}
            </button>
          </form>
        </div>

        {/* Right Side: Active Personnel List */}
        <div style={{ flex: '2 1 400px' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
              Active Security Roster ({guards.length})
            </h3>
            
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center' }}><span className="spinner" /></div>
            ) : guards.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: '20px 0' }}>
                No security guards have been added yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {guards.map(guard => (
                  <div key={guard._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-raised)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 24 }}>👮</span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{guard.username}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Registered: {new Date(guard.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDelete(guard._id, guard.username)}
                      style={{ background: 'transparent', border: '1px solid var(--critical)', color: 'var(--critical)', cursor: 'pointer', padding: '6px 12px', fontSize: 12, fontWeight: 700, borderRadius: 4, transition: '0.2s' }}
                      onMouseOver={e => { e.target.style.background = 'var(--critical)'; e.target.style.color = '#fff' }}
                      onMouseOut={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--critical)' }}
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
