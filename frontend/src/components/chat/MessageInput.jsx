import { useRef } from 'react'

/**
 * MessageInput
 * The bottom input bar: emergency button, image attach, text field, send button,
 * and the hint/rate-limit bar below.
 */
export default function MessageInput({
  message,
  setMessage,
  imageFile,
  setImageFile,
  isEmergency,
  rateLimitWarning,
  onSend,
  onOpenEmergencyModal,
  privateChatMode,
  setPrivateChatMode,
}) {
  const fileRef = useRef(null)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
  }

  return (
    <>
      {/* Input bar */}
      <div className="chat-input-bar">
        {/* Emergency template button */}
        <button
          className={`btn btn-sm ${isEmergency ? 'btn-danger' : 'btn-ghost'}`}
          onClick={onOpenEmergencyModal}
          title="Quick emergency message templates"
        >
          🚨
        </button>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => setImageFile(e.target.files[0])}
        />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => fileRef.current?.click()}
          title="Attach image"
        >
          📷
        </button>

        {/* Image filename preview */}
        {imageFile && (
          <span style={{
            fontSize: 12, color: 'var(--accent)',
            whiteSpace: 'nowrap', alignSelf: 'center',
          }}>
            {imageFile.name.slice(0, 16)}…
          </span>
        )}

        {/* Text input */}
        <input
          className="input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isEmergency
              ? '🚨 Fill in the [brackets] with your details, then send…'
              : 'Type a message or tap the alert button for emergencies…'
          }
          style={{
            flex: 1,
            borderColor: isEmergency ? 'var(--critical)' : undefined,
            boxShadow:   isEmergency ? '0 0 0 3px var(--critical-dim)' : undefined,
          }}
        />

        <button className="btn btn-primary btn-sm" onClick={onSend}>
          Send →
        </button>
      </div>

      {/* Hint / rate-limit bar */}
      <div style={{
        display: 'flex', gap: 16, padding: '6px 20px',
        background: 'var(--bg-surface)', borderTop: '1px solid var(--border)',
        fontSize: 11, color: 'var(--text-muted)',
        alignItems: 'center',
      }}>
        {rateLimitWarning ? (
          <span style={{
            color: 'var(--high)', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 6,
            animation: 'fade-in 0.2s ease',
          }}>
            ⏱️ You&apos;re sending too fast — slow down a moment
          </span>
        ) : isEmergency ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 600, color: 'var(--critical)' }}>🚨 Emergency Draft</span>
            <span style={{ color: 'var(--border-light)' }}>|</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11 }}>
              <span title="Controls who can privately chat with you about this emergency">Response Mode:</span>
              <button 
                type="button"
                onClick={() => setPrivateChatMode('controlled')}
                style={{
                   padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                   background: privateChatMode === 'controlled' ? 'var(--accent)' : 'transparent',
                   color: privateChatMode === 'controlled' ? '#fff' : 'var(--text-muted)',
                   border: `1px solid ${privateChatMode === 'controlled' ? 'var(--accent)' : 'var(--border)'}`,
                   transition: 'all 0.2s'
                }}
              >
                Controlled (Require Approval)
              </button>
              <button 
                type="button"
                onClick={() => setPrivateChatMode('open')}
                style={{
                   padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
                   background: privateChatMode === 'open' ? 'var(--critical)' : 'transparent',
                   color: privateChatMode === 'open' ? '#fff' : 'var(--text-muted)',
                   border: `1px solid ${privateChatMode === 'open' ? 'var(--critical)' : 'var(--border)'}`,
                   transition: 'all 0.2s'
                }}
              >
                Open (Instant Replies)
              </button>
            </div>
          </div>
        ) : (
          <>
            <span>⚠️ Quick alerts</span>
            <span style={{ color: 'var(--border-light)' }}>|</span>
            <span>📷 Attach media</span>
          </>
        )}
      </div>
    </>
  )
}
