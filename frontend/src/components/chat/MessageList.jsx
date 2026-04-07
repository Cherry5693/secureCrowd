import { useState } from 'react'

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
export default function MessageList({ messages, anonymousId, section, onRequestPrivate, bottomRef, uploadProgress = {} }) {
  const [selectedImage, setSelectedImage] = useState(null)
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
              
              {msg.isTemp && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>• Sending...</span>}

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
              <div style={{ position: 'relative', display: 'inline-block', marginTop: 6 }}>
                <img
                  src={msg.imageUrl}
                  alt="shared"
                  onClick={() => {
                    const upStat = uploadProgress[msg.tempId]
                    // Only expand if it's completely finished or not uploading
                    if (upStat === undefined || upStat === 100) setSelectedImage(msg.imageUrl)
                  }}
                  style={{ 
                    maxWidth: 240, borderRadius: 'var(--radius-md)', display: 'block',
                    cursor: (uploadProgress[msg.tempId] === undefined || uploadProgress[msg.tempId] === 100) ? 'pointer' : 'default',
                    transition: 'filter 0.3s ease',
                    filter: (uploadProgress[msg.tempId] !== undefined && uploadProgress[msg.tempId] < 100 && uploadProgress[msg.tempId] >= 0) 
                              ? 'blur(6px) brightness(0.8)' 
                              : 'none'
                  }}
                />
                
                {/* SVG Circular Progress Indicator */}
                {uploadProgress[msg.tempId] !== undefined && uploadProgress[msg.tempId] >= 0 && (
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: 48, height: 48, background: 'rgba(0,0,0,0.5)', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <svg width="40" height="40" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.2)" strokeWidth="8"/>
                      <circle 
                        cx="50" cy="50" r="40" fill="transparent" 
                        stroke="#fff" 
                        strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * Math.min(uploadProgress[msg.tempId], 100)) / 100}
                        style={{ transition: 'stroke-dashoffset 0.3s ease-out, stroke 0.3s ease' }}
                      />
                    </svg>
                  </div>
                )}

                {/* Error Indicator */}
                {uploadProgress[msg.tempId] === -1 && (
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    background: 'rgba(255, 59, 48, 0.9)', color: '#fff', padding: '6px 12px',
                    borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center'
                  }}>
                    <span>⚠️ Failed</span>
                  </div>
                )}
              </div>
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

      {/* Lightbox Overlay */}
      {selectedImage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <button 
            onClick={() => setSelectedImage(null)}
            style={{ 
               position: 'absolute', top: 20, right: 20, background: 'transparent', 
               border: 'none', color: '#fff', fontSize: 32, cursor: 'pointer' 
            }}
          >
            ✕
          </button>
          <img 
            src={selectedImage} 
            alt="Enlarged view" 
            style={{ maxWidth: '95%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} 
          />
        </div>
      )}
    </>
  )
}
