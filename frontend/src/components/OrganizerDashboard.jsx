import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { QRCode } from 'react-qr-code'
import OrganizerEventCreate from './OrganizerEventCreate'
import SecurityTeamManager from './SecurityTeamManager'
import TacticalMap from './TacticalMap'

import Navbar from "../components/navbar/Navbar.jsx"
import { apiFetch } from '../utils/api'

const API = import.meta.env.VITE_API_URL

const formatTime = (t) => new Date(t).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
const formatFullDate = (t) => new Date(t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

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
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [mapAlert,       setMapAlert]       = useState(null)
  const [debriefModal,   setDebriefModal]   = useState(null)
  const [listTab, setListTab] = useState('active')
  const bottomRef = useRef(null)

  const fetchEvents = async () => {
    if (!organizer.token) {
      navigate('/auth')
      return
    }
    setLoading(true)
    try {
      const r = await apiFetch(`${API}/api/events`, {
        headers: { Authorization: `Bearer ${organizer.token}` },
      })
      if (r.status === 401) {
        localStorage.removeItem('organizerUser')
        localStorage.removeItem('geo_location')
        navigate('/auth')
        return
      }
      const data = await r.json()
      setEvents(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch events on mount
  useEffect(() => {
    fetchEvents()
  }, [])

  const handleDeactivate = async (eventId, e) => {
    e.stopPropagation() // Prevent triggering watchEvent click
    if (!window.confirm('Are you sure you want to deactivate this event? All attendee connections will be permanently severed.')) return

    try {
      const r = await apiFetch(`${API}/api/events/${eventId}/close`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${organizer.token}` }
      })
      if (r.ok) {
        if (selected?._id === eventId) setSelected(prev => ({ ...prev, isActive: false }))
        fetchEvents()
      }
    } catch (err) {
      console.error(err)
    }
  }

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
    localStorage.removeItem('geo_location')
    navigate('/auth')
  }

  const joinUrl = (qrToken) => `${window.location.origin}/join?token=${qrToken}`

  // Broadcast to all
  const handleBroadcast = () => {
    const text = broadcastMessage.trim()
    if (!text || !socketRef.current || !selected) return
    setIsBroadcasting(true)
    socketRef.current.emit('organizer_broadcast', { eventId: selected._id, message: text })
    setTimeout(() => {
      setIsBroadcasting(false)
      setBroadcastMessage('')
    }, 500) // slight delay for UX
  }

  // Toggle section panel
  const handleSectionClick = (s) => {
    setActiveSection(prev => prev === s ? null : s)
  }

  // Total attendees across all sections
  const totalAttendees = Object.values(sectionMembers).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Navbar */}
      <Navbar handleLogout={handleLogout} />

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
            <button className="btn btn-ghost btn-full btn-sm"
              style={{ marginTop: 8, color: view === 'security' ? 'var(--accent)' : 'var(--text-secondary)' }}
              onClick={() => { setView('security'); setSelected(null) }}>
              🛡️ Security Team
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
            <div style={{ display: 'flex', gap: 8, padding: '0 8px', marginBottom: 16 }}>
              <button 
                onClick={() => { setListTab('active'); setSelected(null); setView('events') }} 
                style={{ flex: 1, padding: '6px', fontSize: 12, fontWeight: 700, borderRadius: 20, border: 'none', background: listTab === 'active' ? 'var(--accent)' : 'var(--bg-raised)', color: listTab === 'active' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}>
                Active
              </button>
              <button 
                onClick={() => { setListTab('history'); setSelected(null); setView('events') }} 
                style={{ flex: 1, padding: '6px', fontSize: 12, fontWeight: 700, borderRadius: 20, border: 'none', background: listTab === 'history' ? 'var(--accent)' : 'var(--bg-raised)', color: listTab === 'history' ? '#fff' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}>
                History
              </button>
            </div>

            {loading && <div style={{ textAlign: 'center', padding: 20 }}><span className="spinner" /></div>}
            {!loading && events.filter(e => listTab === 'active' ? e.isActive : !e.isActive).length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0 8px' }}>
                {listTab === 'active' ? 'No active events' : 'No history yet'}
              </p>
            )}
            {events.filter(e => listTab === 'active' ? e.isActive : !e.isActive).map(ev => (
              <div key={ev._id} role="button" tabIndex={0} onClick={() => watchEvent(ev)} style={{
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
                  {ev.isActive ? (
                    <span style={{ fontSize: 11, color: 'var(--safe)' }}>Active</span>
                  ) : (
                    <span style={{
                      background: 'var(--text-muted)', color: '#fff', 
                      padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700 
                    }}>INACTIVE</span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {ev.sections?.join(', ')}
                  </span>
                </div>
                {ev.isActive && (
                  <button 
                    onClick={(e) => handleDeactivate(ev._id, e)}
                    style={{
                      marginTop: 10, width: '100%', padding: '6px 0',
                      background: 'transparent', border: '1px solid var(--critical)',
                      color: 'var(--critical)', borderRadius: 'var(--radius-sm)', fontSize: 11,
                      cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600
                    }}
                    onMouseOver={e => { e.target.style.background = 'var(--critical)'; e.target.style.color = '#fff' }}
                    onMouseOut={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--critical)' }}
                  >
                    ⏹ Deactivate Event
                  </button>
                )}
                {!ev.isActive && ev.aiDebrief && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setDebriefModal(ev) }}
                    style={{
                      marginTop: 10, width: '100%', padding: '6px 0',
                      background: 'rgba(56, 189, 248, 0.1)', border: '1px solid var(--accent)',
                      color: 'var(--accent)', borderRadius: 'var(--radius-sm)', fontSize: 11,
                      cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600
                    }}
                    onMouseOver={e => { e.target.style.background = 'var(--accent)'; e.target.style.color = '#fff' }}
                    onMouseOut={e => { e.target.style.background = 'rgba(56, 189, 248, 0.1)'; e.target.style.color = 'var(--accent)' }}
                  >
                    🧠 View AI Debrief
                  </button>
                )}
              </div>
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

          {/* Security Team View */}
          {view === 'security' && (
            <SecurityTeamManager organizerToken={organizer.token} />
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

          {/* History Event View */}
          {view === 'watch' && selected && !selected.isActive && (
            <div className="fade-in">
              <div style={{ padding: 28, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'inline-block', marginBottom: 12, padding: '4px 10px', background: 'var(--text-muted)', color: '#fff', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                  HISTORY RECORD
                </div>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>
                  {selected.name}
                </h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 32 }}>
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Location</p>
                      <p style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 600 }}>📍 {selected.location}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Sections</p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {selected.sections.map(s => (
                          <span key={s} style={{ background: 'var(--bg-raised)', padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 32, marginTop: 8 }}>
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Started (IST)</p>
                      <p style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500 }}>{formatFullDate(selected.startTime)}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Ended (IST)</p>
                      <p style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500 }}>{formatFullDate(selected.endTime)}</p>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 32, padding: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 'var(--radius-md)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <div>
                    <h4 style={{ color: 'var(--critical)', fontSize: 15, margin: '0 0 6px 0' }}>Event Data Purged</h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5, margin: 0 }}>
                      This event has concluded. All associated messages, emergency alerts, and participant records have been permanently deleted from the database in accordance with privacy policies. 
                      Further interaction or broadcasting is disabled.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Watch Event View */}
          {view === 'watch' && selected && selected.isActive && (
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
                  textAlign: 'center', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center'
                }}>
                  <QRCode value={joinUrl(selected.qrToken)} size={100} />
                  <p style={{ fontSize: 10, color: '#666', marginTop: 6, marginBottom: 8 }}>Scan to join</p>
                  
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, background: '#f4f4f5', 
                    padding: '4px 8px', borderRadius: 4, border: '1px solid #e4e4e7',
                    maxWidth: 140
                  }}>
                    <span style={{ 
                      fontSize: 10, fontFamily: 'monospace', color: '#18181b', 
                      fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }} title={selected.qrToken}>
                      {selected.qrToken}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(selected.qrToken)}
                      title="Copy full event code"
                      style={{ 
                        background: 'none', border: 'none', cursor: 'pointer', 
                        fontSize: 12, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      📋
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Broadcast Message Panel ────────────────────────────────── */}
              <div style={{
                background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--accent-dim)', padding: 20, marginBottom: 24,
                boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  📢 Send Official Broadcast
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  This message will instantly appear as an authoritative alert in <strong>all active sections</strong>.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <input
                    className="input"
                    placeholder="Type an announcement or instructions..."
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleBroadcast() }}
                    style={{ flex: 1 }}
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleBroadcast}
                    disabled={isBroadcasting || !broadcastMessage.trim()}
                  >
                    {isBroadcasting ? 'Sending...' : 'Broadcast Now'}
                  </button>
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
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatTime(alert.time)}</span>
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
                    liveFeed.map((msg, i) => {
                      const isAnnouncement = msg.isAnnouncement || msg.sender === 'ORGANIZER'
                      return (
                        <div key={i} style={{
                          padding: '8px 0', borderBottom: '1px solid var(--border)',
                          display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13,
                        }}>
                          <span style={{
                            background: isAnnouncement ? 'var(--accent-dim)' : msg.isEmergency ? 'var(--critical-dim)' : sectionColor(msg.section) + '22',
                            color: isAnnouncement ? 'var(--accent)' : msg.isEmergency ? 'var(--critical)' : sectionColor(msg.section),
                            border: `1px solid ${isAnnouncement ? 'var(--accent)' : msg.isEmergency ? 'var(--critical)' : sectionColor(msg.section) + '66'}`,
                            borderRadius: 20, padding: '2px 8px', fontSize: 11, whiteSpace: 'nowrap',
                            fontWeight: 700,
                          }}>
                            {isAnnouncement ? '📢 ALL' : `§${msg.section}`}
                          </span>
                          <span style={{ color: isAnnouncement ? 'var(--accent)' : 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: isAnnouncement ? 700 : 400 }}>
                            {msg.sender === 'ORGANIZER' ? 'You (Broadcast)' : msg.sender}
                          </span>
                          <span style={{ color: 'var(--text-primary)', flex: 1 }}>{msg.message}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                            {formatTime(msg.time)}
                          </span>
                        </div>
                      )
                    })
                  )}
                  <div ref={bottomRef} />
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
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

      {/* AI Debrief Modal */}
      {debriefModal && (
        <div 
          onClick={() => setDebriefModal(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <div 
            onClick={e => e.stopPropagation()}
            style={{
              width: '90%', maxWidth: 640, background: '#18181b', padding: 32,
              borderRadius: 16, border: '1px solid #3f3f46', boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
          >
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, fontSize: 22 }}>
              <span style={{ fontSize: 24 }}>🧠</span> AI Security Debrief
            </h2>
            <div style={{ marginBottom: 24, fontSize: 12, color: 'var(--text-muted)' }}>
              Automated Post-Mortem Report for {debriefModal.name} <br/>
              Total Incidents Logged: <b>{debriefModal.incidentCount}</b>
            </div>
            
            <div style={{ 
              background: '#000', padding: '24px', borderRadius: 8, 
              whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#f4f4f5', fontSize: 14,
              borderLeft: '4px solid var(--accent)'
            }}>
              {debriefModal.aiDebrief}
            </div>
            
            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDebriefModal(null)} className="btn btn-ghost" style={{ background: '#27272a' }}>
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
