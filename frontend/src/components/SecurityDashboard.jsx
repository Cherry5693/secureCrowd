import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import PrivateChat from './PrivateChat'
import TacticalMap from './TacticalMap'
import { apiFetch } from '../utils/api'

const API = import.meta.env.VITE_API_URL

const formatTime = (t) => new Date(t).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })

export default function SecurityDashboard() {
  const staff = JSON.parse(localStorage.getItem('organizerUser') || '{}')
  const navigate  = useNavigate()
  const socketRef = useRef(null)

  const [events,         setEvents]         = useState([])
  const [selected,       setSelected]       = useState(null)
  const [liveAlerts,     setLiveAlerts]     = useState([])
  const [loading,        setLoading]        = useState(true)
  const [privateRooms,   setPrivateRooms]   = useState([])
  const [mapAlert,       setMapAlert]       = useState(null)
  const [myId]                              = useState(`SECURITY_${Math.floor(100 + Math.random() * 900)}`)

  const fetchEvents = async () => {
    if (!staff.token) return navigate('/auth')
    setLoading(true)
    try {
      const r = await apiFetch(`${API}/api/events`, {
        headers: { Authorization: `Bearer ${staff.token}` },
      })
      if (r.status === 401) {
        localStorage.removeItem('organizerUser')
        localStorage.removeItem('geo_location')
        return navigate('/auth')
      }
      const data = await r.json()
      setEvents(Array.isArray(data) ? data.filter(e => e.isActive) : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchEvents() }, [])

  // Socket for live monitoring
  useEffect(() => {
    if (!staff.token) return
    const socket = io(API, { auth: { token: staff.token } })
    socket.anonymousId = myId
    socketRef.current = socket

    socket.on('organizer_alert', (alert) => {
      setLiveAlerts(prev => {
        // Prevent duplicates
        if (prev.some(a => String(a._id) === String(alert._id))) return prev
        return [alert, ...prev]
      })
    })

    socket.on('organizer_emergency_history', (historyAlerts) => {
      setLiveAlerts(historyAlerts)
    })

    socket.on('emergency_resolved', (data) => {
      setLiveAlerts(prev => prev.map(a => 
        String(a._id) === String(data.alertId) ? { ...a, resolved: true, resolvedBy: data.resolvedBy } : a
      ))
    })

    // Private Chat endpoints
    socket.on('private_chat_request', (room) => {
      setPrivateRooms(prev => prev.some(r => r.roomId === room.roomId) ? prev : [...prev, room])
    })
    socket.on('private_room_created', (room) => {
      setPrivateRooms(prev => prev.some(r => r.roomId === room.roomId) ? prev : [...prev, room])
    })
    socket.on('private_chat_resolved', (data) => {
      setPrivateRooms(prev => prev.filter(r => r.roomId !== data.roomId))
    })

    return () => socket.disconnect()
  }, [staff.token])

  const watchEvent = (event) => {
    setSelected(event)
    setLiveAlerts([])
    socketRef.current?.emit('organizer_watch', { eventId: event._id })
  }

  const handleLogout = () => {
    socketRef.current?.disconnect()
    localStorage.removeItem('organizerUser')
    localStorage.removeItem('geo_location')
    navigate('/auth')
  }

  const requestPrivate = (targetSender, topic, section, alertId) => {
    if (!selected) return
    socketRef.current?.emit('request_private_chat', {
      eventId: selected._id,
      section,
      topic: topic.slice(0, 60),
      targetAnonymousId: targetSender,
      alertId,
    })
  }

  const closePrivateRoom = (roomId) => {
    setPrivateRooms(prev => prev.filter(r => r.roomId !== roomId))
  }

  const markResolved = (alertId) => {
    socketRef.current?.emit('resolve_emergency', { alertId, resolverId: staff.username || 'Security' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0a0a0c', color: '#e4e4e7' }}>

      {/* Navbar Minimal */}
      <nav style={{ padding: '12px 20px', background: '#111113', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🛡️</span>
          <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1, color: 'var(--critical)' }}>SECURITY DISPATCH</span>
          <span style={{ fontSize: 13, color: '#a1a1aa' }}>/ Active Overwatch</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#a1a1aa' }}>👤 {staff.username}</span>
          <button style={{ background: 'transparent', border: '1px solid #3f3f46', color: '#e4e4e7', cursor: 'pointer', padding: '4px 12px', borderRadius: 4, fontSize: 12 }} onClick={handleLogout}>LOGOUT</button>
        </div>
      </nav>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar (Active Events Only) */}
        <aside style={{ width: 280, background: '#111113', borderRight: '1px solid #27272a', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 16, borderBottom: '1px solid #27272a', fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#71717a' }}>TARGET ACQUISITION</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {loading && <div style={{ color: '#71717a', fontSize: 13, textAlign: 'center' }}>Scanning active instances...</div>}
            {!loading && events.length === 0 && <div style={{ color: '#71717a', fontSize: 13 }}>No active events found.</div>}
            
            {events.map(ev => (
              <button key={ev._id} onClick={() => watchEvent(ev)} style={{
                width: '100%', textAlign: 'left', padding: '12px', borderRadius: 6,
                background: selected?._id === ev._id ? '#18181b' : 'transparent',
                border: `1px solid ${selected?._id === ev._id ? '#52525b' : 'transparent'}`,
                marginBottom: 4, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f4f4f5' }}>{ev.name}</div>
                <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>📍 {ev.location}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--critical)', animation: 'pulse-critical 2s infinite' }} />
                  <span style={{ fontSize: 11, color: '#e4e4e7', fontWeight: 600 }}>LIVE TRACKING</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Dispatch Screen */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {!selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#52525b' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
              <h2 style={{ fontSize: 18 }}>NO TARGET SELECTED</h2>
              <p style={{ fontSize: 13 }}>Select an event from the sidebar to begin overwatch.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid #27272a', paddingBottom: 16, flexShrink: 0 }}>
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#f4f4f5' }}>{selected.name}</h2>
                  <p style={{ fontSize: 13, color: '#a1a1aa', marginTop: 4 }}>Scanning {selected.sections?.length || 0} active sections for highly urgent anomalies.</p>
                </div>
              </div>

              {liveAlerts.length === 0 ? (
                <div style={{ background: '#111113', border: '1px solid #27272a', borderRadius: 8, padding: 32, textAlign: 'center' }}>
                  <span style={{ fontSize: 32 }}>✓</span>
                  <p style={{ color: 'var(--safe)', marginTop: 12, fontWeight: 600, letterSpacing: 1 }}>ALL SECTORS SECURE</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>
                  {liveAlerts.map(alert => (
                    <div key={alert._id} style={{
                      background: alert.resolved ? 'rgba(48,209,88,0.05)' : '#18181b',
                      border: `1px solid ${alert.resolved ? 'var(--safe)' : alert.urgencyLevel === 'CRITICAL' ? 'var(--critical)' : 'var(--high)'}`,
                      borderRadius: 8, padding: 16,
                      boxShadow: alert.resolved ? 'none' : `0 0 16px ${alert.urgencyLevel === 'CRITICAL' ? 'rgba(255,45,85,0.1)' : 'rgba(255,149,0,0.1)'}`,
                    }}>
                      {/* Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ background: alert.resolved ? 'var(--safe)' : alert.urgencyLevel === 'CRITICAL' ? 'var(--critical)' : 'var(--high)', color: '#000', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 4 }}>
                            {alert.resolved ? 'RESOLVED' : alert.urgencyLevel}
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#f4f4f5' }}>Sector {alert.section}</span>
                          {alert.triangulation && (
                            <span style={{ fontSize: 11, background: '#27272a', padding: '2px 6px', borderRadius: 4, color: '#d4d4d8', fontWeight: 600 }}>
                              📍 {alert.triangulation}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: '#71717a' }}>{formatTime(alert.time)}</span>
                      </div>

                      {/* Message */}
                      <div style={{ fontSize: 14, color: '#e4e4e7', lineHeight: 1.5, marginBottom: 16, background: '#111113', padding: 12, borderRadius: 4, borderLeft: `2px solid ${alert.resolved ? 'var(--safe)' : 'var(--critical)'}` }}>
                        "{alert.message}"
                      </div>

                      {/* Keywords */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                         {alert.urgencyKeywords?.map(kw => (
                           <span key={kw} style={{ background: '#27272a', color: '#a1a1aa', fontSize: 10, padding: '2px 6px', borderRadius: 4 }}>{kw}</span>
                         ))}
                      </div>

                      {/* Map & Actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {alert.location && (
                          <button 
                            onClick={() => setMapAlert(alert)}
                            style={{ width: '100%', background: '#2563eb', border: 'none', color: '#fff', padding: '8px', fontSize: 12, fontWeight: 700, borderRadius: 4, cursor: 'pointer' }}
                          >
                            📍 VIEW ON TACTICAL MAP
                          </button>
                        )}

                        {!alert.resolved && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button 
                              style={{ flex: 1, background: '#27272a', border: 'none', color: '#f4f4f5', padding: '8px', fontSize: 12, fontWeight: 600, borderRadius: 4, cursor: 'pointer' }}
                              onClick={() => requestPrivate(alert.sender, alert.message, alert.section, alert._id)}
                            >
                              💬 Comm Link
                            </button>
                            <button 
                              style={{ flex: 1, background: 'var(--safe)', border: 'none', color: '#000', padding: '8px', fontSize: 12, fontWeight: 700, borderRadius: 4, cursor: 'pointer' }}
                              onClick={() => markResolved(alert._id)}
                            >
                              ✓ Clear Issue
                            </button>
                          </div>
                        )}

                        {alert.resolved && (
                          <div style={{ fontSize: 11, color: 'var(--safe)', textAlign: 'center', marginTop: 8 }}>
                            Cleared by {alert.resolvedBy}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Floating private chat windows */}
      {privateRooms.map((room, index) => (
        <PrivateChat
          key={room.roomId}
          room={room}
          myId={myId}
          socket={socketRef.current}
          onClose={() => closePrivateRoom(room.roomId)}
          offsetIndex={index}
        />
      ))}

      {/* Floating Tactical Map Modal */}
      {mapAlert && (
        <div 
          onClick={() => setMapAlert(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              width: '90%', maxWidth: 1000, height: '80%', background: '#000',
              borderRadius: 16, overflow: 'hidden', position: 'relative',
              border: '1px solid #3f3f46', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
          >
            <button 
              onClick={() => setMapAlert(null)}
              style={{
                position: 'absolute', top: 16, right: 16, zIndex: 10000,
                background: 'var(--critical)', color: '#fff', border: 'none', cursor: 'pointer',
                width: 36, height: 36, borderRadius: '50%', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
            >
              ✕
            </button>
            <TacticalMap alerts={[mapAlert]} />
          </div>
        </div>
      )}
    </div>
  )
}
