import { useState, useEffect, useRef } from 'react'

export default function PrivateChat({ room, myId, onClose, socket }) {
  const [message,  setMessage]  = useState('')
  const [messages, setMessages] = useState([])
  const [joined,   setJoined]   = useState(false)
  const bottomRef = useRef(null)

  // ── Socket listeners (fixed from useState → useEffect with cleanup) ──────────
  useEffect(() => {
    if (!socket) return

    const onPrivateMsg = (msg) => {
      if (msg.roomId === room.roomId) {
        setMessages(prev => [...prev, msg])
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }

    const onJoined = (data) => {
      if (data.roomId === room.roomId) setJoined(true)
    }

    const onResolved = (data) => {
      if (data.roomId === room.roomId) onClose()
    }

    socket.on('receive_private_message', onPrivateMsg)
    socket.on('private_chat_joined',     onJoined)
    socket.on('private_chat_resolved',   onResolved)

    return () => {
      socket.off('receive_private_message', onPrivateMsg)
      socket.off('private_chat_joined',     onJoined)
      socket.off('private_chat_resolved',   onResolved)
    }
  }, [socket, room.roomId])

  const accept  = () => socket?.emit('accept_private_chat',  { roomId: room.roomId })
  const resolve = () => socket?.emit('resolve_private_chat', { roomId: room.roomId })

  const send = () => {
    if (!message.trim()) return
    socket?.emit('send_private_message', { roomId: room.roomId, message })
    setMessage('')
  }

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, width: 320,
      background: 'var(--bg-card)', border: '1px solid var(--accent)',
      borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-accent)',
      display: 'flex', flexDirection: 'column', zIndex: 500,
      maxHeight: 420,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>🔒 Private Channel</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Re: {room.topic || 'Emergency'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {joined && (
            <button
              onClick={resolve}
              style={{
                background: 'var(--safe-dim)', color: 'var(--safe)',
                border: '1px solid var(--safe)', borderRadius: 'var(--radius-sm)',
                padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
              title="Mark issue as resolved — closes chat for both parties"
            >
              ✅ Resolved
            </button>
          )}
          <button onClick={onClose}
            style={{ background: 'none', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
      </div>

      {/* Accept prompt — shown to the TARGET user */}
      {!joined && room.requesterId !== myId && (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            <strong style={{ color: 'var(--accent)' }}>{room.requesterId}</strong> wants to connect privately
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
            Topic: {room.topic}
          </p>
          <button className="btn btn-primary btn-sm btn-full" onClick={accept}>
            Accept &amp; Join
          </button>
        </div>
      )}

      {/* Waiting state — shown to the REQUESTER before accepted */}
      {!joined && room.requesterId === myId && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          <span className="spinner" style={{ marginBottom: 10 }} />
          <p style={{ marginTop: 10 }}>Waiting for the other person to accept…</p>
        </div>
      )}

      {/* Chat — visible once joined */}
      {joined && (
        <>
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {messages.length === 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', marginTop: 20 }}>
                Private channel open — messages visible only to you two
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.sender === myId ? 'flex-end' : 'flex-start',
                background: m.sender === myId ? 'var(--accent-dim)' : 'var(--bg-raised)',
                border: `1px solid ${m.sender === myId ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)', padding: '8px 12px',
                maxWidth: '85%', fontSize: 13,
              }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 3 }}>{m.sender}</div>
                <div style={{ color: 'var(--text-primary)' }}>{m.message}</div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
            <input
              className="input"
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Private message…"
              style={{ flex: 1, padding: '8px 12px', fontSize: 13 }}
            />
            <button className="btn btn-primary btn-sm" onClick={send}>→</button>
          </div>
        </>
      )}
    </div>
  )
}
