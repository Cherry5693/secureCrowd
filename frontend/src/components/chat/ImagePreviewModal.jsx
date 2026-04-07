import React, { useState, useEffect } from 'react'

export default function ImagePreviewModal({ file, onSend, onCancel }) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [highRes, setHighRes] = useState(false)

  // Generate a local object URL for instant preview
  useEffect(() => {
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  if (!file) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 10, 12, 0.95)', zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: 20
    }}>
      {/* Title */}
      <h3 style={{ color: '#f4f4f5', margin: '0 0 24px 0', fontSize: 18, fontWeight: 600 }}>Preview Image</h3>

      {/* Image Preview */}
      <div style={{
        maxWidth: '100%', width: 400, maxHeight: '60vh', 
        borderRadius: 12, overflow: 'hidden', 
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        marginBottom: 32, display: 'flex', justifyContent: 'center',
        background: '#000'
      }}>
        {previewUrl && (
          <img 
            src={previewUrl} 
            alt="Preview" 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
          />
        )}
      </div>

      {/* Controls Container */}
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* High Res Toggle */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#18181b', padding: '16px 20px', borderRadius: 8,
          border: '1px solid #27272a'
        }}>
          <div>
            <div style={{ color: '#f4f4f5', fontSize: 14, fontWeight: 600 }}>High Quality</div>
            <div style={{ color: '#a1a1aa', fontSize: 12, marginTop: 4 }}>Send uncompressed original image</div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
            <input 
              type="checkbox" 
              checked={highRes}
              onChange={(e) => setHighRes(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }} 
            />
            <span style={{
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: highRes ? 'var(--accent)' : '#3f3f46',
              transition: '0.3s', borderRadius: 24
            }}>
              <span style={{
                position: 'absolute', height: 18, width: 18, left: 3, top: 3,
                backgroundColor: 'white', transition: '0.3s', borderRadius: '50%',
                transform: highRes ? 'translateX(20px)' : 'translateX(0)'
              }} />
            </span>
          </label>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            onClick={onCancel}
            style={{
              flex: 1, padding: '14px', borderRadius: 8, fontWeight: 600,
              background: 'transparent', color: '#f4f4f5', border: '1px solid #3f3f46',
              cursor: 'pointer', transition: 'background 0.2s'
            }}
          >
            Cancel
          </button>
          <button 
            onClick={() => onSend(highRes)}
            style={{
              flex: 1, padding: '14px', borderRadius: 8, fontWeight: 600,
              background: 'var(--accent)', color: '#fff', border: 'none',
              cursor: 'pointer', transition: 'background 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
            }}
          >
            Send ✈️
          </button>
        </div>
      </div>
    </div>
  )
}
