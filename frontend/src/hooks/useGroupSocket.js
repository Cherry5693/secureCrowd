import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'

const API = import.meta.env.VITE_API_URL

/**
 * useGroupSocket
 * Owns the entire Socket.IO lifecycle for an attendee session.
 * Returns state slices and action callbacks for Groups.jsx to consume.
 */
export function useGroupSocket({ token, event, section, anonymousId }) {
  const navigate    = useNavigate()
  const socketRef   = useRef(null)

  // ── Local Push Notifications ────────────────────────────────────────────────
  const notify = (title, body) => {
    // Only fire if tab is in the background
    if (document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/shield.svg' })
    }
  }

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const [connected,          setConnected]          = useState(false)
  const [messages,           setMessages]           = useState([])
  const [members,            setMembers]            = useState([])
  const [emergencies,        setEmergencies]        = useState([])
  const [activeAlert,        setActiveAlert]        = useState(null)
  const [privateRooms,       setPrivateRooms]       = useState([])
  const [crossSectionAlerts, setCrossSectionAlerts] = useState([])
  const [rateLimitWarning,   setRateLimitWarning]   = useState(false)
  const [deactivatedMessage, setDeactivatedMessage] = useState(null)

  // ── Socket lifecycle ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !event?.id) { navigate('/join'); return }

    const socket = io(API, { auth: { token } })
    socketRef.current = socket

    // Connection
    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join_section', { eventId: event.id, section })
    })
    socket.on('disconnect',    () => setConnected(false))
    socket.on('connect_error', (e) => console.error('[Socket]', e.message))

    // Messages
    socket.on('message_history', (history) => setMessages(history))
    socket.on('receive_message', (msg) => {
      if (msg.crossSection) return
      setMessages(prev => [...prev, msg])
      if (msg.isEmergency) {
        setEmergencies(prev => [...prev, msg])
        if (msg.urgencyLevel === 'CRITICAL') setActiveAlert(msg)
      }
      
      if (msg.isEmergency || msg.isAnnouncement) {
        notify(
          msg.isAnnouncement ? '📢 Official Broadcast' : `🚨 Emergency Alert (Section ${section})`,
          msg.message
        )
      }
    })

    // Members
    socket.on('members_update', setMembers)

    // Rate limiting
    socket.on('rate_limited', () => {
      setRateLimitWarning(true)
      setTimeout(() => setRateLimitWarning(false), 4000)
    })

    // Emergency alerts (cross-section broadcasts)
    socket.on('emergency_alert', (alert) => {
      setEmergencies(prev => [...prev, alert])
      if (alert.crossSection) {
        setCrossSectionAlerts(prev => {
          const exists = prev.some(a => String(a._id) === String(alert._id))
          return exists ? prev : [alert, ...prev]
        })
      } else {
        setActiveAlert(alert)
      }
      notify(`🚨 Emergency Alert (Section ${alert.originalSection})`, alert.message)
    })

    // Emergency resolved
    socket.on('emergency_resolved', (data) => {
      setCrossSectionAlerts(prev =>
        prev.map(a =>
          String(a._id) === String(data.alertId)
            ? { ...a, resolved: true, resolvedBy: data.resolvedBy }
            : a
        )
      )
      setTimeout(() => {
        setCrossSectionAlerts(prev =>
          prev.filter(a => String(a._id) !== String(data.alertId))
        )
      }, 5000)
    })

    // Private chat
    socket.on('private_chat_request', (room) => {
      if (room.requesterId !== anonymousId) {
        setPrivateRooms(prev => {
          if (prev.some(r => r.roomId === room.roomId)) return prev
          return [...prev, room]
        })
        notify('🔒 Private Chat Request', `Responding to your alert: ${room.topic}`)
      }
    })
    socket.on('private_room_created', (room) => {
      setPrivateRooms(prev => {
        if (prev.some(r => r.roomId === room.roomId)) return prev
        return [...prev, room]
      })
    })
    socket.on('private_chat_resolved', (data) => {
      setPrivateRooms(prev => prev.filter(r => r.roomId !== data.roomId))
    })

    // Event deactivation
    socket.on('event_deactivated', (data) => {
      setDeactivatedMessage(data.message)
      socket.disconnect() // Sever connection cleanly client-side too
    })

    return () => socket.disconnect()
  }, [token]) // eslint-disable-line

  // ── Actions ──────────────────────────────────────────────────────────────────
  const sendMessage = (text, imageFile, privateChatMode = 'controlled') => {
    const socket = socketRef.current
    if (!socket) return
    const txt = text.trim()
    if (!txt && !imageFile) return

    if (imageFile) {
      if (imageFile.size > 2 * 1024 * 1024) {
        alert('Image must be under 2 MB')
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        socket.emit('send_message', {
          eventId: event.id, section,
          message: txt || '[Image]', imageUrl: e.target.result,
          privateChatMode,
        })
      }
      reader.readAsDataURL(imageFile)
    } else {
      socket.emit('send_message', { eventId: event.id, section, message: txt, privateChatMode })
    }
  }

  const requestPrivate = (targetSender, sourceMsgText, alertId = null) => {
    socketRef.current?.emit('request_private_chat', {
      eventId: event.id,
      section,
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

  const dismissAlert = (alertId) => {
    setCrossSectionAlerts(prev => prev.filter(a => String(a._id) !== String(alertId)))
  }

  const clearCrossSectionAlerts = () => setCrossSectionAlerts([])

  const closePrivateRoom = (roomId) => {
    setPrivateRooms(prev => prev.filter(r => r.roomId !== roomId))
  }

  return {
    // state
    connected,
    messages,
    members,
    emergencies,
    activeAlert,
    setActiveAlert,
    privateRooms,
    closePrivateRoom,
    crossSectionAlerts,
    rateLimitWarning,
    deactivatedMessage,
    // actions
    sendMessage,
    requestPrivate,
    handleLeave,
    dismissAlert,
    clearCrossSectionAlerts,
    // ref (passed to PrivateChat)
    socket: socketRef.current,
    socketRef,
  }
}
