const formatTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const urgencyClass = (level) => {
  if (level === 'CRITICAL') return 'msg msg-critical'
  if (level === 'HIGH')     return 'msg msg-high'
  return 'msg msg-normal'
}

/**
 * MessageList
 * Renders the scrollable message thread.
 * bottomRef is forwarded from the parent to trigger auto-scroll.
 */
export default function MessageList({ messages, anonymousId, section, onRequestPrivate, bottomRef }) {
  if (messages.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60, fontSize: 14 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
        <p>No messages yet in Section {section}</p>
        <p style={{ fontSize: 12, marginTop: 6 }}>You are anonymous — your identity is protected</p>
      </div>
    )
  }

  return (
    <>
      {messages.map((msg, i) => {
        const isAnnouncement = msg.isAnnouncement || msg.sender === 'ORGANIZER'
        const isMe = !isAnnouncement && (msg.sender === anonymousId || msg.anonymousId === anonymousId)

        // ── Announcement Message ──
        if (isAnnouncement) {
          return (
            <div key={msg._id || i} className="msg" style={{
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent)',
              borderLeftWidth: '4px',
            }}>
              <div className="msg-sender" style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 6 }}>
                📢 OFFICIAL ANNOUNCEMENT
              </div>
              <div className="msg-text" style={{ fontSize: 14, fontWeight: 500 }}>
                {msg.message}
              </div>
              <div className="msg-time" style={{ color: 'var(--text-muted)' }}>
                {formatTime(msg.time)}
              </div>
            </div>
          )
        }

        // ── Standard User Message ──
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
              <img
                src={msg.imageUrl}
                alt="shared"
                style={{ maxWidth: 240, borderRadius: 'var(--radius-md)', marginTop: 6 }}
              />
            ) : (
              <div className="msg-text">{msg.message}</div>
            )}

            <div className="msg-time" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {formatTime(msg.time)}
              {!isMe && msg.isEmergency && (
                <button
                  onClick={() => onRequestPrivate(msg.sender || msg.anonymousId, msg.message)}
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
    </>
  )
}
