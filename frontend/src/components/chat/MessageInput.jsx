import { useEffect, useRef, useState } from 'react'
import LiveCameraModal from './LiveCameraModal'
import ImagePreviewModal from './ImagePreviewModal'

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
  isUploading,
  onSend,
  onDirectCameraSend,
  onOpenEmergencyModal,
  privateChatMode,
  setPrivateChatMode,
  analyzeDraft,
  isAnalyzingDraft,
}) {
  const fileRef = useRef(null)
  const [showLiveCamera, setShowLiveCamera] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)

  // ── Real-time Draft Debounce ─────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (analyzeDraft) analyzeDraft(message)
    }, 1500)
    return () => clearTimeout(timer)
  }, [message, analyzeDraft])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
  }

  return (
    <>
      {/* Input bar */}
      <div className="chat-input-bar">
        {/* Emergency template button */}
        <button
          disabled={isUploading}
          className={`btn btn-sm ${isEmergency ? 'btn-danger' : 'btn-ghost'}`}
          onClick={onOpenEmergencyModal}
          title="Quick emergency message templates"
          style={{ opacity: isUploading ? 0.5 : 1 }}
        >
          🚨
        </button>

        {/* Hidden file inputs */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
             if (e.target.files[0]) setPreviewFile(e.target.files[0])
             e.target.value = null // reset so same file can be picked again
          }}
        />

        <button
          disabled={isUploading}
          className="btn btn-ghost btn-sm"
          onClick={() => fileRef.current?.click()}
          title="Attach image from gallery"
          style={{ padding: '0 6px', opacity: isUploading ? 0.5 : 1 }}
        >
          🖼️
        </button>

        <button
          disabled={isUploading}
          className="btn btn-ghost btn-sm"
          onClick={() => setShowLiveCamera(true)}
          title="Take live photo with camera"
          style={{ padding: '0 6px', opacity: isUploading ? 0.5 : 1 }}
        >
          📸
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
          disabled={isUploading}
          className="input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isUploading
              ? 'Sending image...'
              : isEmergency
              ? '🚨 Fill in the [brackets] with your details, then send…'
              : 'Type a message or tap the alert button for emergencies…'
          }
          style={{
            flex: 1,
            opacity: isUploading ? 0.6 : 1,
            borderColor: isEmergency ? 'var(--critical)' : undefined,
            boxShadow:   isEmergency ? '0 0 0 3px var(--critical-dim)' : undefined,
          }}
        />

        <button 
           className="btn btn-primary btn-sm" 
           onClick={onSend}
           disabled={isUploading || (!message.trim() && !imageFile)}
           style={{ opacity: (isUploading || (!message.trim() && !imageFile)) ? 0.5 : 1 }}
        >
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
            {isAnalyzingDraft ? (
              <span style={{ color: 'var(--accent)' }}>
                🤖 AI Analyzing draft...
              </span>
            ) : (
              <span>⚠️ Quick alerts</span>
            )}
            <span style={{ color: 'var(--border-light)' }}>|</span>
            <span>📷 Attach media</span>
          </>
        )}
      </div>

      {showLiveCamera && (
        <LiveCameraModal 
          onCapture={(file) => {
            setShowLiveCamera(false)
            setPreviewFile(file)
          }}
          onClose={() => setShowLiveCamera(false)}
        />
      )}

      {previewFile && (
        <ImagePreviewModal
          file={previewFile}
          onCancel={() => setPreviewFile(null)}
          onSend={(highRes) => {
            onDirectCameraSend(previewFile, highRes)
            setPreviewFile(null)
          }}
        />
      )}
    </>
  )
}
