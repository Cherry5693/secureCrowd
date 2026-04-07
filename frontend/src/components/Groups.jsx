import { useEffect, useRef, useState, useCallback } from 'react'
import { useGroupSocket }  from '../hooks/useGroupSocket'
import Members            from './Members'
import EmergencyAlert     from './EmergencyAlert'
import PrivateChat        from './PrivateChat'
import EmergencyPanel     from './chat/EmergencyPanel'
import MessageList        from './chat/MessageList'
import MessageInput       from './chat/MessageInput'
import EmergencyModal     from './chat/EmergencyModal'

export default function Groups() {
  const session = JSON.parse(sessionStorage.getItem('attendeeSession') || '{}')
  const { anonymousId, token, event, section: initialSection } = session

  // ── Input state (owned here, passed down to MessageInput) ────────────────────
  const [message,            setMessage]           = useState('')
  const [imageFile,          setImageFile]         = useState(null)
  const [isEmergency,        setIsEmergency]       = useState(false)
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [privateChatMode,    setPrivateChatMode]   = useState('controlled')

  // ── Socket hook (all real-time logic lives here) ─────────────────────────────
  const {
    connected, messages, members, emergencies,
    activeAlert, setActiveAlert,
    privateRooms, closePrivateRoom,
    crossSectionAlerts, rateLimitWarning, deactivatedMessage,
    liveDraftEmergency, setLiveDraftEmergency, isAnalyzingDraft,
    uploadProgress,
    sendMessage, analyzeDraft, requestPrivate, handleLeave,
    dismissAlert, clearCrossSectionAlerts,
    socketRef,
  } = useGroupSocket({ token, event, section: initialSection, anonymousId })

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  const bottomRef = useRef(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(() => {
    sendMessage(message, imageFile, privateChatMode)
    setMessage('')
    setImageFile(null)
    setIsEmergency(false)
    setLiveDraftEmergency(false)
    setPrivateChatMode('controlled')
  }, [message, imageFile, privateChatMode, sendMessage, setLiveDraftEmergency])

  // ── Instant Send for Live Camera & Gallery ─────────────────────────────────
  const handleDirectCameraSend = useCallback((file, highRes) => {
    // Instantly fires the message with the newly captured blob, bypassing normal queue
    sendMessage(message, file, privateChatMode, highRes)
    setMessage('')
    setImageFile(null)
    setIsEmergency(false)
    setLiveDraftEmergency(false)
  }, [message, privateChatMode, sendMessage, setLiveDraftEmergency])

  // ── Emergency template selected ──────────────────────────────────────────────
  const handleTemplateSelect = (text) => {
    setMessage(text)
    setIsEmergency(true)
    setShowEmergencyModal(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (deactivatedMessage) {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)',
        color: 'var(--text-primary)', textAlign: 'center', padding: 20
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏹️</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: 'var(--critical)' }}>Event Closed</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 15, maxWidth: 400, lineHeight: 1.5 }}>
          {deactivatedMessage}
        </p>
        <button className="btn btn-primary" onClick={handleLeave} style={{ padding: '10px 24px' }}>
          Return to Login
        </button>
      </div>
    )
  }

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
            boxShadow:  connected ? '0 0 6px var(--safe)' : '0 0 6px var(--critical)',
          }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{anonymousId}</span>
          <button className="btn btn-ghost btn-sm" onClick={handleLeave}>Leave</button>
        </div>
      </nav>

      {/* Main layout */}
      <div className="chat-layout">

        {/* Messages column */}
        <div className="chat-main">

          {/* Cross-section emergency broadcasts */}
          <EmergencyPanel
            alerts={crossSectionAlerts}
            onClearAll={clearCrossSectionAlerts}
            onRespond={requestPrivate}
            onDismiss={dismissAlert}
          />

          {/* Message thread */}
          <div className="chat-messages">
            <MessageList
              messages={messages}
              anonymousId={anonymousId}
              section={initialSection}
              onRequestPrivate={requestPrivate}
              bottomRef={bottomRef}
              uploadProgress={uploadProgress}
            />
          </div>

          {/* Input + hint bar */}
          <MessageInput
            message={message}
            setMessage={setMessage}
            imageFile={imageFile}
            setImageFile={setImageFile}
            isEmergency={isEmergency || liveDraftEmergency}
            rateLimitWarning={rateLimitWarning}
            isUploading={Object.values(uploadProgress).some(p => p >= 0 && p < 100)}
            onSend={handleSend}
            onDirectCameraSend={handleDirectCameraSend}
            onOpenEmergencyModal={() => setShowEmergencyModal(true)}
            privateChatMode={privateChatMode}
            setPrivateChatMode={setPrivateChatMode}
            analyzeDraft={analyzeDraft}
            isAnalyzingDraft={isAnalyzingDraft}
          />
        </div>

        {/* Members + active alerts sidebar */}
        <Members members={members} emergencies={emergencies} />
      </div>

      {/* Emergency template modal */}
      {showEmergencyModal && (
        <EmergencyModal
          onSelect={handleTemplateSelect}
          onClose={() => setShowEmergencyModal(false)}
        />
      )}

      {/* Full-screen emergency overlay */}
      {activeAlert && (
        <EmergencyAlert alert={activeAlert} onDismiss={() => setActiveAlert(null)} />
      )}

      {/* Floating private chat windows */}
      {privateRooms.map((room, index) => (
        <PrivateChat
          key={room.roomId}
          room={room}
          myId={anonymousId}
          socket={socketRef.current}
          onClose={() => closePrivateRoom(room.roomId)}
          offsetIndex={index}
        />
      ))}
    </div>
  )
}