import React, { useEffect, useRef, useState } from 'react'

export default function LiveCameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let activeStream = null
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' } // Prefer back camera on mobile
        })
        activeStream = mediaStream
        setStream(mediaStream)
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream
        }
      } catch (err) {
        console.error('Camera error', err)
        setError('Camera access denied or unavailable.')
      }
    }
    
    startCamera()

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    
    // Set canvas dimensions to match video stream
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    // Draw the current video frame onto the canvas
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // Convert canvas to a Blob (file) and trigger onCapture
    canvas.toBlob((blob) => {
      if (blob) {
         const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
         onCapture(file)
      }
    }, 'image/jpeg', 0.9)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.9)', zIndex: 9999,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 600, padding: 16, position: 'absolute', top: 0 }}>
        <div style={{ color: '#fff', fontWeight: 600 }}>Live Feed</div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}>✕</button>
      </div>

      {error ? (
        <div style={{ color: 'var(--critical)', textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', maxWidth: 600, maxHeight: '70vh', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      )}

      {!error && (
        <div style={{ position: 'absolute', bottom: 40 }}>
           <button 
             onClick={handleCapture}
             style={{
               width: 70, height: 70, borderRadius: '50%',
               background: 'transparent', border: '4px solid #fff',
               display: 'flex', alignItems: 'center', justifyContent: 'center',
               cursor: 'pointer', outline: 'none'
             }}
           >
             <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#ff3b30' }} />
           </button>
        </div>
      )}
    </div>
  )
}
