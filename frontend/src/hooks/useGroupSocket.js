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
  const [liveDraftEmergency, setLiveDraftEmergency] = useState(false)
  const [isAnalyzingDraft,   setIsAnalyzingDraft]   = useState(false)
  const [userLocation,       setUserLocation]       = useState(null)
  const [uploadProgress,     setUploadProgress]     = useState({})

  // ── Geolocation Background Tracking ─────────────────────────────────────────
  useEffect(() => {
    if ('geolocation' in navigator) {
      const geoId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => console.warn('[Geolocation]', error.message),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      )
      return () => navigator.geolocation.clearWatch(geoId)
    }
  }, [])

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

    // Draft Analysis
    socket.on('draft_analysis_result', (result) => {
      setLiveDraftEmergency(result.isEmergency)
      setIsAnalyzingDraft(false)
    })

    // Messages
    socket.on('message_history', (history) => setMessages(history))
    socket.on('receive_message', (msg) => {
      if (msg.crossSection) return

      setMessages(prev => {
        // If this is the server acknowledging our optimistic image upload:
        if (msg.tempId) {
          const matchIdx = prev.findIndex(p => p._id === msg.tempId)
          if (matchIdx !== -1) {
            const copy = [...prev]
            copy[matchIdx] = msg
            return copy
          }
        }
        // Deduplicate standard messages just in case
        if (prev.some(p => p._id === msg._id)) return prev
        return [...prev, msg]
      })
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
  const sendMessage = (text, imageFile, privateChatMode = 'controlled', highRes = false) => {
    const socket = socketRef.current
    if (!socket) return
    const txt = text.trim()
    if (!txt && !imageFile) return

    if (imageFile) {
      if (imageFile.size > 2 * 1024 * 1024 && !highRes) {
        alert('Image must be under 2 MB unless High Quality is requested.')
        return
      }
      
      const tempId = 'temp_' + Date.now() + Math.floor(Math.random()*1000)
      const reader = new FileReader()
      
      reader.onload = (e) => {
        const localImgUrl = e.target.result

        // 1. Optimistically append message to local state
        const tempMsg = {
          _id: tempId,
          tempId,
          isTemp: true,
          sender: anonymousId,
          anonymousId: anonymousId,
          message: txt || '',
          messageType: 'image',
          imageUrl: localImgUrl,
          time: new Date(),
        }
        setMessages(prev => [...prev, tempMsg])

        // 2. Start progress tracking
        setUploadProgress(prev => ({ ...prev, [tempId]: 0 }))
        let currentProgress = 0
        const pTimer = setInterval(() => {
          setUploadProgress(prev => {
            currentProgress = prev[tempId] || 0
            if (currentProgress >= 90) return prev
            // smoothly increment to 90%
            return { ...prev, [tempId]: currentProgress + Math.floor(Math.random() * 10) + 2 }
          })
        }, 300)

        // 3. Emit with callback
        socket.emit('send_message', {
          eventId: event.id, section,
          message: txt || '[Image]', imageUrl: localImgUrl,
          privateChatMode, location: userLocation, highRes, tempId
        }, (res) => {
          clearInterval(pTimer)
          if (res && res.success) {
            setUploadProgress(prev => ({ ...prev, [tempId]: 100 }))
            // Keep circle rendered for 400ms to visually fill, then remove state entirely
            setTimeout(() => {
              setUploadProgress(prev => {
                const copy = {...prev}; delete copy[tempId]; return copy;
              })
            }, 400)
          } else {
            console.error('Upload Error:', res)
            setUploadProgress(prev => ({ ...prev, [tempId]: -1 })) // -1 acts as an error state
          }
        })
      }
      reader.readAsDataURL(imageFile)
    } else {
      socket.emit('send_message', { eventId: event.id, section, message: txt, privateChatMode, location: userLocation })
    }
  }

  const analyzeDraft = (text) => {
    const socket = socketRef.current
    if (!socket || !text.trim()) {
      setLiveDraftEmergency(false)
      setIsAnalyzingDraft(false)
      return
    }
    setIsAnalyzingDraft(true)
    socket.emit('analyze_draft', { eventId: event.id, section, message: text })
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
    liveDraftEmergency,
    setLiveDraftEmergency,
    isAnalyzingDraft,
    uploadProgress,
    // actions
    sendMessage,
    analyzeDraft,
    requestPrivate,
    handleLeave,
    dismissAlert,
    clearCrossSectionAlerts,
    // ref (passed to PrivateChat)
    socket: socketRef.current,
    socketRef,
  }
}
