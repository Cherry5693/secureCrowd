import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { QRCode } from 'react-qr-code'
import OrganizerEventCreate from './OrganizerEventCreate'

const API = import.meta.env.VITE_API_URL

const formatTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// Colour per section letter (cycles for 26 letters)
const SECTION_COLORS = [
  '#6c63ff', '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
  '#f4845f', '#a78bfa', '#34d399', '#fb923c', '#e879f9',
]
const sectionColor = (s) => SECTION_COLORS[s.charCodeAt(0) % SECTION_COLORS.length]

export default function OrganizerDashboard() {
  const organizer = JSON.parse(localStorage.getItem('organizerUser') || '{}')
  const navigate  = useNavigate()
  const socketRef = useRef(null)

  const [view,           setView]           = useState('events')
  const [events,         setEvents]         = useState([])
  const [selected,       setSelected]       = useState(null)
  const [liveAlerts,     setLiveAlerts]     = useState([])
  const [liveFeed,       setLiveFeed]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [sectionMembers, setSectionMembers] = useState({})  // { A: [], B: [], ... }
  const [activeSection,  setActiveSection]  = useState(null) // which section pill is expanded
  const bottomRef = useRef(null)

  // Fetch events on mount
  useEffect(() => {
    fetch(`${API}/api/events`, {
      headers: { Authorization: `Bearer ${organizer.token}` },
    })
      .then(r => r.json())
      .then(data => { setEvents(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Socket for live monitoring
  useEffect(() => {
    if (!organizer.token) return
    const socket = io(API, { auth: { token: organizer.token } })
    socketRef.current = socket

    socket.on('organizer_message', (msg) => {
      setLiveFeed(prev => [...prev.slice(-99), msg])
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    })

    socket.on('organizer_alert', (alert) => {
      setLiveAlerts(prev => [alert, ...prev].slice(0, 20))
    })

    // Real-time section member updates
    socket.on('organizer_section_update', ({ section, members }) => {
      setSectionMembers(prev => ({ ...prev, [section]: members }))
    })

    return () => socket.disconnect()
  }, [organizer.token])

  const watchEvent = (event) => {
    setSelected(event)
    setLiveAlerts([])
    setLiveFeed([])
    setSectionMembers({})
    setActiveSection(null)
    setView('watch')
    socketRef.current?.emit('organizer_watch', { eventId: event._id })
  }

  const handleLogout = () => {
    socketRef.current?.disconnect()
    localStorage.removeItem('organizerUser')
    navigate('/auth')
  }

  const joinUrl = (qrToken) => `${window.location.origin}/join?token=${qrToken}`

  // Toggle section panel
  const handleSectionClick = (s) => {
    setActiveSection(prev => prev === s ? null : s)
  }

  // Total attendees across all sections
  const totalAttendees = Object.values(sectionMembers).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo">
          <span>🛡️</span>
          <span>SecureCrowd</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 13 }}> / Organizer</span>
        </div>
        <div className="nav-right">
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>👤 {organizer.username}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Left Sidebar */}
        <aside style={{
          width: 260, background: 'var(--bg-surface)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
            <button className="btn btn-primary btn-full btn-sm"
              onClick={() => { setView('create'); setSelected(null) }}>
              + Create Event
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
            <p style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: 1, padding: '0 8px', marginBottom: 8,
            }}>Your Events</p>

            {loading && <div style={{ textAlign: 'center', padding: 20 }}><span className="spinner" /></div>}
            {!loading && events.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0 8px' }}>No events yet</p>
            )}
            {events.map(ev => (
              <button key={ev._id} onClick={() => watchEvent(ev)} style={{
                width: '100%', textAlign: 'left', padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                background: selected?._id === ev._id ? 'var(--accent-dim)' : 'transparent',
                border: `1px solid ${selected?._id === ev._id ? 'var(--accent)' : 'transparent'}`,
                marginBottom: 4, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{ev.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>📍 {ev.location}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span className="status-dot"
                    style={{ background: ev.isActive ? 'var(--safe)' : 'var(--text-muted)' }} />
                  <span style={{ fontSize: 11, color: ev.isActive ? 'var(--safe)' : 'var(--text-muted)' }}>
                    {ev.isActive ? 'Active' : 'Closed'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {ev.sections?.join(', ')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 28, background: 'var(--bg-base)' }}>

          {/* Create Event View */}
          {view === 'create' && (
            <div className="fade-in">
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: 'var(--text-primary)' }}>
                Create New Event
              </h2>
              <OrganizerEventCreate onCreated={(ev) => {
                setEvents(prev => [ev, ...prev])
                watchEvent(ev)
              }} />
            </div>
          )}

          {/* No event selected */}
          {view === 'events' && !selected && (
            <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--text-muted)' }} className="fade-in">
              <div style={{ fontSize: 56, marginBottom: 16 }}>📡</div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-secondary)' }}>Select an Event to Monitor</h2>
              <p style={{ fontSize: 14, marginTop: 8 }}>Click an event in the sidebar to see live alerts and feeds</p>
              <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => setView('create')}>
                + Create Your First Event
              </button>
            </div>
          )}

          {/* Watch Event View */}
          {view === 'watch' && selected && (
            <div className="fade-in">

              {/* ── Event Header ─────────────────────────────────────────────── */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                marginBottom: 20, flexWrap: 'wrap', gap: 16,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selected.name}
                    </h2>
                    {/* Live attendee counter */}
                    {totalAttendees > 0 && (
                      <span style={{
                        background: 'var(--safe-dim)', color: 'var(--safe)',
                        border: '1px solid var(--safe)', borderRadius: 20,
                        padding: '2px 12px', fontSize: 12, fontWeight: 700,
                      }}>
                        👥 {totalAttendees} live
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 12 }}>
                    📍 {selected.location}
                  </p>

                  {/* ── Clickable Section Pills ────────────────────────────── */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selected.sections?.map(s => {
                      const count   = sectionMembers[s]?.length ?? 0
                      const isOpen  = activeSection === s
                      const color   = sectionColor(s)
                      return (
                        <button
                          key={s}
                          onClick={() => handleSectionClick(s)}
                          title={`Click to view Section ${s} members`}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: isOpen ? color + '22' : 'var(--bg-raised)',
                            border: `1px solid ${isOpen ? color : 'var(--border)'}`,
                            borderRadius: 20, padding: '5px 14px',
                            fontSize: 12, fontWeight: 600,
                            color: isOpen ? color : 'var(--text-secondary)',
                            cursor: 'pointer', transition: 'all 0.2s',
                            boxShadow: isOpen ? `0 0 10px ${color}44` : 'none',
                          }}
                        >
                          <span style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: count > 0 ? 'var(--safe)' : 'var(--border)',
                            flexShrink: 0,
                          }} />
                          Section {s}
                          {/* Attendee count badge */}
                          <span style={{
                            background: isOpen ? color : 'var(--bg-surface)',
                            color: isOpen ? '#fff' : 'var(--text-muted)',
                            borderRadius: 20, padding: '1px 7px',
                            fontSize: 11, fontWeight: 700, marginLeft: 2,
                            minWidth: 20, textAlign: 'center',
                          }}>
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* QR Code */}
                <div style={{
                  background: '#fff', borderRadius: 'var(--radius-md)', padding: 12,
                  textAlign: 'center', flexShrink: 0,
                }}>
                  <QRCode value={joinUrl(selected.qrToken)} size={100} />
                  <p style={{ fontSize: 10, color: '#666', marginTop: 6 }}>Scan to join</p>
                </div>
              </div>

              {/* ── Section Detail Panel (shown when a section is clicked) ───── */}
              {activeSection && (
                <div style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${sectionColor(activeSection)}`,
                  borderRadius: 'var(--radius-lg)',
                  marginBottom: 24,
                  overflow: 'hidden',
                  animation: 'fade-in 0.2s ease',
                  boxShadow: `0 0 20px ${sectionColor(activeSection)}22`,
                }}>
                  {/* Panel header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px',
                    background: sectionColor(activeSection) + '18',
                    borderBottom: `1px solid ${sectionColor(activeSection)}44`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: sectionColor(activeSection),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, fontWeight: 800, color: '#fff',
                      }}>
                        {activeSection}
                      </span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                          Section {activeSection}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                          Real-time • Updates live as people join or leave
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* People count */}
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          fontSize: 28, fontWeight: 800, color: sectionColor(activeSection),
                          lineHeight: 1,
                        }}>
                          {sectionMembers[activeSection]?.length ?? 0}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>people</div>
                      </div>
                      <button
                        onClick={() => setActiveSection(null)}
                        style={{
                          background: 'none', color: 'var(--text-muted)',
                          fontSize: 20, lineHeight: 1, padding: '0 4px',
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Member list */}
                  <div style={{ padding: '16px 20px' }}>
                    {(sectionMembers[activeSection]?.length ?? 0) === 0 ? (
                      <div style={{
                        textAlign: 'center', padding: '24px 0',
                        color: 'var(--text-muted)', fontSize: 13,
                      }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>👤</div>
                        <p>No attendees in Section {activeSection} yet</p>
                        <p style={{ fontSize: 11, marginTop: 4 }}>Share the QR code to invite guests</p>
                      </div>
                    ) : (
                      <>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
                          gap: 8,
                        }}>
                          {sectionMembers[activeSection].map((memberId, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              background: 'var(--bg-raised)', border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-md)', padding: '8px 12px',
                              fontSize: 12,
                            }}>
                              <span style={{
                                width: 26, height: 26, borderRadius: '50%',
                                background: sectionColor(activeSection) + '33',
                                border: `1px solid ${sectionColor(activeSection)}66`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 13, flexShrink: 0,
                              }}>👤</span>
                              <span style={{
                                color: 'var(--text-secondary)', fontFamily: 'monospace',
                                fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {memberId}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div style={{
                          marginTop: 12, fontSize: 11, color: 'var(--text-muted)',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: 'var(--safe)', animation: 'pulse-critical 2s infinite',
                            display: 'inline-block',
                          }} />
                          Live count — updates instantly as attendees join or leave
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Live Emergency Alerts ────────────────────────────────────── */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{
                  fontSize: 15, fontWeight: 700, color: 'var(--critical)',
                  marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  🚨 Live Emergency Alerts
                  {liveAlerts.filter(a => a.urgencyLevel === 'CRITICAL').length > 0 && (
                    <span style={{
                      background: 'var(--critical)', color: '#fff',
                      borderRadius: 20, padding: '1px 10px', fontSize: 11, fontWeight: 700,
                    }}>
                      {liveAlerts.filter(a => a.urgencyLevel === 'CRITICAL').length} CRITICAL
                    </span>
                  )}
                </h3>
                {liveAlerts.length === 0 ? (
                  <div style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', padding: '16px 20px',
                  }}>
                    <p style={{ color: 'var(--safe)', fontSize: 14 }}>
                      ✅ No active emergencies — event is safe
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {liveAlerts.map((a, i) => (
                      <div key={i} className={a.urgencyLevel === 'CRITICAL' ? 'msg msg-critical' : 'msg msg-high'}>
                        <div className="msg-sender">
                          {a.urgencyLevel === 'CRITICAL' ? '🚨' : '⚠️'}
                          <span className={`msg-badge ${a.urgencyLevel === 'CRITICAL' ? 'badge-critical' : 'badge-high'}`}
                            style={{ marginLeft: 8 }}>
                            {a.urgencyLevel}
                          </span>
                          <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: 11 }}>
                            Section {a.section} • {formatTime(a.time)}
                          </span>
                        </div>
                        <div className="msg-text">{a.message}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          Reporter: {a.sender} • Keywords: {a.urgencyKeywords?.join(', ') || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Live Message Feed ─────────────────────────────────────────── */}
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
                  📡 Live Message Feed (All Sections)
                </h3>
                <div style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', maxHeight: 360, overflowY: 'auto', padding: 16,
                }}>
                  {liveFeed.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
                      Waiting for messages…
                    </p>
                  ) : (
                    liveFeed.map((msg, i) => (
                      <div key={i} style={{
                        padding: '8px 0', borderBottom: '1px solid var(--border)',
                        display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13,
                      }}>
                        <span style={{
                          background: msg.isEmergency ? 'var(--critical-dim)' : sectionColor(msg.section) + '22',
                          color: msg.isEmergency ? 'var(--critical)' : sectionColor(msg.section),
                          border: `1px solid ${msg.isEmergency ? 'var(--critical)' : sectionColor(msg.section) + '66'}`,
                          borderRadius: 20, padding: '2px 8px', fontSize: 11, whiteSpace: 'nowrap',
                          fontWeight: 700,
                        }}>
                          §{msg.section}
                        </span>
                        <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{msg.sender}</span>
                        <span style={{ color: 'var(--text-primary)', flex: 1 }}>{msg.message}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                          {formatTime(msg.time)}
                        </span>
                      </div>
                    ))
                  )}
                  <div ref={bottomRef} />
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  )
}
