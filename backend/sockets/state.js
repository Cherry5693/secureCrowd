/**
 * sockets/state.js
 * Shared in-memory state for the Socket.IO layer.
 * Centralised here so handlers can import without circular deps.
 */

// { [eventId]: { [section]: [{ anonymousId, sockets: [socketId] }] } }
const sectionMembers = {}

// { [roomId]: { requesterId, requesterSocketId, targetId, topic, section, eventId, alertId, participants } }
const privateRooms = {}

// { [socketId]: eventId }
const organizerWatching = {}

// ── Section helpers ───────────────────────────────────────────────────────────

const getMemberList = (eventId, section) =>
  (sectionMembers[eventId]?.[section] || []).map((m) => m.anonymousId)

const addMember = (eventId, section, anonymousId, socketId) => {
  if (!sectionMembers[eventId]) sectionMembers[eventId] = {}
  if (!sectionMembers[eventId][section]) sectionMembers[eventId][section] = []
  
  const sectionList = sectionMembers[eventId][section]
  const member = sectionList.find((m) => m.anonymousId === anonymousId)
  
  if (member) {
    if (!member.sockets.includes(socketId)) {
      member.sockets.push(socketId)
    }
  } else {
    sectionList.push({ anonymousId, sockets: [socketId] })
  }
}

const removeMember = (eventId, section, socketId) => {
  if (!sectionMembers[eventId]?.[section]) return
  
  const sectionList = sectionMembers[eventId][section]
  const memberIndex = sectionList.findIndex((m) => m.sockets.includes(socketId))
  
  if (memberIndex !== -1) {
    const member = sectionList[memberIndex]
    member.sockets = member.sockets.filter((sid) => sid !== socketId)
    
    // If no tabs/sockets left for this user, remove them completely
    if (member.sockets.length === 0) {
      sectionList.splice(memberIndex, 1)
    }
  }
}

// ── Rate limiter ──────────────────────────────────────────────────────────────

const rateLimits  = {}   // { socketId: [timestamps] }
const RATE_MAX    = 1
const RATE_WINDOW = 30_000 // ms

const isRateLimited = (socketId) => {
  const now   = Date.now()
  const times = (rateLimits[socketId] || []).filter((t) => now - t < RATE_WINDOW)
  if (times.length >= RATE_MAX) return true
  rateLimits[socketId] = [...times, now]
  return false
}

const cleanupSocket = (socketId) => {
  delete rateLimits[socketId]
  delete organizerWatching[socketId]
}

module.exports = {
  sectionMembers,
  privateRooms,
  organizerWatching,
  rateLimits,
  getMemberList,
  addMember,
  removeMember,
  isRateLimited,
  cleanupSocket,
}
