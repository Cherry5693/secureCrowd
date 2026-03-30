import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import Members from './Members'
import EmergencyAlert from './EmergencyAlert'
import PrivateChat from './PrivateChat'

const API = import.meta.env.VITE_API_URL

const formatTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const urgencyClass = (level) => {
  if (level === 'CRITICAL') return 'msg msg-critical'
  if (level === 'HIGH')     return 'msg msg-high'
  return 'msg msg-normal'
}

const EMERGENCY_TEMPLATES = [
  {
    title: 'Lost Child',
    preview: "URGENT: I've lost my child. Name: [child...",
    text: "URGENT: I've lost my child. Name: [child name], wearing [description]. Last seen near [location]. Please help find them!",
  },
  {
    title: 'Medical Emergency',
    preview: 'MEDICAL EMERGENCY: I need medical assist...',
    text: 'MEDICAL EMERGENCY: I need medical assistance immediately at [location]. Patient condition: [describe condition].',
  },
  {
    title: 'Lost Person',
    preview: "URGENT: I've been separated from my grou...",
    text: "URGENT: I've been separated from my group. I am at [location]. Please help me find [person name / description].",
  },
  {
    title: 'Suspicious Activity',
    preview: 'ALERT: I noticed suspicious activity nea...',
    text: 'ALERT: I noticed suspicious activity near [location]. Description: [describe what you saw]. Please send security immediately.',
  },
]

export default function Groups() {
  const session  = JSON.parse(sessionStorage.getItem('attendeeSession') || '{}')
  const { anonymousId, token, event, section: initialSection } = session
  const navigate  = useNavigate()
  const socketRef = useRef(null)
  const bottomRef = useRef(null)

  const [messages,           setMessages]          = useState([])
  const [members,            setMembers]           = useState([])
  const [emergencies,        setEmergencies]       = useState([])
  const [message,            setMessage]           = useState('')
  const [isEmergency,        setIsEmergency]       = useState(false)
  const [activeAlert,        setActiveAlert]       = useState(null)
  const [privateRoom,        setPrivateRoom]       = useState(null)
  const [connected,           setConnected]          = useState(false)
  const [imageFile,           setImageFile]          = useState(null)
  const [showEmergencyModal,  setShowEmergencyModal] = useState(false)
  const [crossSectionAlerts,  setCrossSectionAlerts] = useState([])  // emergency broadcasts from other sections
  const fileRef = useRef(null)

  // ── Socket init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !event?.id) { navigate('/join'); return }

    const socket = io(API, { auth: { token } })
    socketRef.current = socket

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join_section', { eventId: event.id, section: initialSection })
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('connect_error', (e) => console.error('Socket error:', e.message))

    socket.on('message_history', (history) => setMessages(history))

    socket.on('receive_message', (msg) => {
      if (msg.crossSection) return // cross-section emergencies go to the Emergency Panel, not the thread
      setMessages(prev => [...prev, msg])
      if (msg.isEmergency) {
        setEmergencies(prev => [...prev, msg])
        if (msg.urgencyLevel === 'CRITICAL') setActiveAlert(msg)
      }
    })

    socket.on('members_update', setMembers)

    socket.on('emergency_alert', (alert) => {
      setEmergencies(prev => [...prev, alert])
      if (alert.crossSection) {
        // From another section → goes to the Emergency Broadcasts panel only
        setCrossSectionAlerts(prev => {
          const exists = prev.some(a => String(a._id) === String(alert._id))
          return exists ? prev : [alert, ...prev]
        })
      } else {
        // Same section → show the full-screen overlay
        setActiveAlert(alert)
      }
    })

    socket.on('private_chat_request', (room) => {
      if (room.requesterId !== anonymousId) setPrivateRoom(room)
    })
    socket.on('private_room_created', (room) => setPrivateRoom(room))

    // Private chat resolved from either end → close the window
    socket.on('private_chat_resolved', () => setPrivateRoom(null))

    // Emergency resolved → mark alert in panel, then auto-remove after 5 s
    socket.on('emergency_resolved', (data) => {
      setCrossSectionAlerts(prev =>
        prev.map(a =>
          String(a._id) === String(data.alertId)
            ? { ...a, resolved: true, resolvedBy: data.resolvedBy }
            : a
        )
      )
      // Auto-remove the resolved card after 5 seconds
      setTimeout(() => {
        setCrossSectionAlerts(prev => prev.filter(a => String(a._id) !== String(data.alertId)))
      }, 5000)
    })

    return () => { socket.disconnect() }
  }, [token]) // eslint-disable-line

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    const txt = message.trim()
    if (!txt && !imageFile) return
    const socket = socketRef.current
    if (!socket) return

    if (imageFile) {
      if (imageFile.size > 2 * 1024 * 1024) {
        alert('Image must be under 2 MB')
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        socket.emit('send_message', {
          eventId: event.id, section: initialSection,
          message: txt || '[Image]', imageUrl: e.target.result,
        })
        setImageFile(null)
      }
      reader.readAsDataURL(imageFile)
    } else {
      socket.emit('send_message', { eventId: event.id, section: initialSection, message: txt })
    }
    setMessage('')
    setIsEmergency(false)
  }, [message, imageFile, event, initialSection])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  // ── Private chat request ─────────────────────────────────────────────────────
  // alertId: optional — the MongoDB _id of the emergency message being responded to
  const requestPrivate = (targetSender, sourceMsgText, alertId = null) => {
    socketRef.current?.emit('request_private_chat', {
      eventId: event.id,
      section: initialSection,
      topic: sourceMsgText.slice(0, 60),
      targetAnonymousId: targetSender,
      alertId,
    })
  }

  const handleLeave = () => {
    socketRef.current?.disconnect()
    sessionStorage.removeItem('attendeeSession')
    navigate('/join')
  }

  // Select an emergency template → fill input
  const selectTemplate = (tpl) => {
    setMessage(tpl.text)
    setIsEmergency(true)
    setShowEmergencyModal(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo">
          <span>🛡️</span>
          <span>SecureCrowd</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 400 }}>
            / {event?.name} / Section {initialSection}
          </span>
        </div>
        <div className="nav-right">
          <span className="status-dot" style={{
            background: connected ? 'var(--safe)' : 'var(--critical)',
            boxShadow: connected ? '0 0 6px var(--safe)' : '0 0 6px var(--critical)',
          }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{anonymousId}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLeave}>Leave</button>
        </div>
      </nav>

      {/* Main layout */}
      <div className="chat-layout">

        {/* Messages area */}
        <div className="chat-main">

          {/* ── Emergency Broadcasts Panel (from other sections) ─────────────── */}
          {crossSectionAlerts.length > 0 && (
            <div style={{
              borderBottom: '2px solid var(--critical)',
              background: 'rgba(255,45,85,0.06)',
              maxHeight: 260,
              overflowY: 'auto',
              flexShrink: 0,
            }}>
              {/* Panel header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: '1px solid var(--critical-dim)',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--critical)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ animation: 'pulse-critical 1.5s infinite', display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--critical)' }} />
                  🚨 EMERGENCY BROADCASTS — Respond via Private Chat Only
                </span>
                <button
                  onClick={() => setCrossSectionAlerts([])}
                  style={{ background: 'none', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600 }}
                >
                  Clear All
                </button>
              </div>

              {/* Individual alerts */}
              {crossSectionAlerts.map((alert, i) => (
                <div key={i} style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  animation: 'fade-in 0.3s ease',
                  background: alert.resolved ? 'rgba(48,209,88,0.06)' : 'transparent',
                  transition: 'background 0.4s ease',
                }}>

                  {/* ── RESOLVED STATE ── */}
                  {alert.resolved ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 24 }}>✅</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--safe)' }}>
                          Issue Resolved
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          Resolved by <strong style={{ color: 'var(--text-secondary)' }}>{alert.resolvedBy}</strong>
                          {' '}· §{alert.originalSection} · Removing in 5s…
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>
                          "{alert.message.slice(0, 70)}{alert.message.length > 70 ? '…' : ''}"
                        </div>
                      </div>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setCrossSectionAlerts(prev => prev.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    /* ── ACTIVE STATE ── */
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{
                          background: 'var(--critical-dim)', color: 'var(--critical)',
                          border: '1px solid var(--critical)', borderRadius: 20,
                          padding: '2px 10px', fontSize: 11, fontWeight: 700,
                        }}>
                          {alert.urgencyLevel}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                          📢 Section {alert.originalSection}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {new Date(alert.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div style={{
                        fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5,
                        background: 'var(--bg-raised)', borderRadius: 'var(--radius-sm)',
                        padding: '8px 12px', marginBottom: 8,
                        borderLeft: '3px solid var(--critical)',
                      }}>
                        {alert.message}
                      </div>

                      {alert.urgencyKeywords?.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                          {alert.urgencyKeywords.map(kw => (
                            <span key={kw} style={{
                              fontSize: 10, fontWeight: 600, padding: '1px 8px',
                              background: 'var(--critical-dim)', color: 'var(--critical)',
                              border: '1px solid var(--critical)', borderRadius: 20,
                            }}>{kw}</span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', flex: 1 }}>
                          Reported by <strong style={{ color: 'var(--text-secondary)' }}>{alert.sender}</strong>
                        </span>
                        {/* Pass alert._id so server knows which alert was resolved */}
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => requestPrivate(alert.sender, alert.message, alert._id)}
                        >
                          🔒 Respond Privately
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setCrossSectionAlerts(prev => prev.filter((_, j) => j !== i))}
                        >
                          Dismiss
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}

            </div>
          )}

          <div className="chat-messages">

            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60, fontSize: 14 }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                <p>No messages yet in Section {initialSection}</p>
                <p style={{ fontSize: 12, marginTop: 6 }}>You are anonymous — your identity is protected</p>
              </div>
            )}

            {messages.map((msg, i) => {
              const isMe = msg.sender === anonymousId || msg.anonymousId === anonymousId
              return (
                <div key={msg._id || i} className={isMe ? 'msg msg-mine' : urgencyClass(msg.urgencyLevel)}>
                  <div className="msg-sender">
                    {isMe ? '🧑 You' : `👤 ${msg.sender || msg.anonymousId}`}
                    {msg.urgencyLevel === 'CRITICAL' && (
                      <span className="msg-badge badge-critical" style={{ marginLeft: 8 }}>🚨 CRITICAL</span>
                    )}
                    {msg.urgencyLevel === 'HIGH' && (
                      <span className="msg-badge badge-high" style={{ marginLeft: 8 }}>⚠️ HIGH</span>
                    )}
                    {/* Cross-section broadcast label */}
                    {msg.crossSection && (
                      <span style={{
                        marginLeft: 8, fontSize: 11, color: 'var(--critical)',
                        background: 'var(--critical-dim)', border: '1px solid var(--critical)',
                        borderRadius: 20, padding: '1px 8px', fontWeight: 600,
                      }}>
                        📢 Broadcast from §{msg.originalSection || msg.section}
                      </span>
                    )}
                  </div>

                  {msg.imageUrl ? (
                    <img src={msg.imageUrl} alt="shared"
                      style={{ maxWidth: 240, borderRadius: 'var(--radius-md)', marginTop: 6 }} />
                  ) : (
                    <div className="msg-text">{msg.message}</div>
                  )}

                  <div className="msg-time" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {formatTime(msg.time)}
                    {/* Private chat only available on emergency messages */}
                    {!isMe && msg.isEmergency && (
                      <button
                        onClick={() => requestPrivate(msg.sender || msg.anonymousId, msg.message)}
                        style={{ background: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 600 }}
                        title="Start a private 1-on-1 chat with this person"
                      >
                        🔒 Private Chat
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="chat-input-bar">
            {/* Emergency button → opens template modal */}
            <button
              className={`btn btn-sm ${isEmergency ? 'btn-danger' : 'btn-ghost'}`}
              onClick={() => setShowEmergencyModal(true)}
              title="Quick emergency message templates"
            >
              🚨
            </button>

            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => setImageFile(e.target.files[0])} />
            <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} title="Attach image">
              📷
            </button>

            {imageFile && (
              <span style={{ fontSize: 12, color: 'var(--accent)', whiteSpace: 'nowrap', alignSelf: 'center' }}>
                {imageFile.name.slice(0, 16)}…
              </span>
            )}

            <input
              className="input"
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isEmergency
                ? '🚨 Fill in the [brackets] with your details, then send…'
                : 'Type a message or tap the alert button for emergencies…'}
              style={{
                flex: 1,
                borderColor: isEmergency ? 'var(--critical)' : undefined,
                boxShadow:   isEmergency ? '0 0 0 3px var(--critical-dim)' : undefined,
              }}
            />
            <button className="btn btn-primary btn-sm" onClick={sendMessage}>
              Send →
            </button>
          </div>

          {/* Hint bar */}
          <div style={{
            display: 'flex', gap: 16, padding: '6px 20px',
            background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
            fontSize: 11, color: 'var(--text-muted)',
          }}>
            <span>⚠️ Quick alerts</span>
            <span style={{ color: 'var(--border-light)' }}>|</span>
            <span>📷 Attach media</span>
          </div>
        </div>

        {/* Sidebar */}
        <Members members={members} emergencies={emergencies} />
      </div>

      {/* ── Emergency Template Modal ───────────────────────────────────────────── */}
      {showEmergencyModal && (
        <div className="emergency-overlay" onClick={() => setShowEmergencyModal(false)}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-xl)',
            padding: '28px',
            maxWidth: 560,
            width: '92%',
            animation: 'fade-in 0.2s ease',
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  background: 'var(--critical-dim)', border: '1px solid var(--critical)',
                  borderRadius: 8, padding: '5px 8px', fontSize: 16,
                }}>⚠️</span>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Quick Emergency Messages
                </h2>
              </div>
              <button onClick={() => setShowEmergencyModal(false)}
                style={{ background: 'none', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1 }}>
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Select a template below, then fill in the [brackets] with your details before sending.
            </p>

            {/* Template grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {EMERGENCY_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.title}
                  onClick={() => selectTemplate(tpl)}
                  className="emergency-template-btn"
                  style={{
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--critical)'
                    e.currentTarget.style.background  = 'var(--critical-dim)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.background  = 'var(--bg-raised)'
                  }}
                >
                  <div style={{
                    background: 'var(--critical-dim)', border: '1px solid var(--critical)',
                    borderRadius: 8, padding: '6px 8px', flexShrink: 0, fontSize: 16,
                  }}>⚠️</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {tpl.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      {tpl.preview}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Emergency overlay alert */}
      {activeAlert && (
        <EmergencyAlert alert={activeAlert} onDismiss={() => setActiveAlert(null)} />
      )}

      {/* Private chat floating window */}
      {privateRoom && (
        <PrivateChat
          room={privateRoom}
          myId={anonymousId}
          socket={socketRef.current}
          onClose={() => setPrivateRoom(null)}
        />
      )}
    </div>
  )
}