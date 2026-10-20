import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { socket } from '../utils/socket.js'
import api from '../utils/api.js'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [sessionCode,       setSessionCode]       = useState(null)
  const [participantName,   setParticipantName]   = useState('')
  const [participantGroup,  setParticipantGroup]  = useState('')
  const [sessionClosed,     setSessionClosed]     = useState(false)

  // Keeps participant data alive so the reconnect handler can re-emit session:join
  // after a mobile screen lock / network change assigns a new socket.id
  const participantDataRef = useRef(null)

  useEffect(() => {
    socket.connect()
    socket.on('session:closed', () => setSessionClosed(true))

    // Re-join room and update socketId in backend after any reconnect
    function onConnect() {
      if (participantDataRef.current) {
        socket.emit('session:join', participantDataRef.current)
      }
    }
    socket.on('connect', onConnect)

    // Try to restore participant session from localStorage
    const keys = Object.keys(localStorage).filter(k => k.startsWith('ports_participant_'))
    if (keys.length > 0) {
      const key = keys[keys.length - 1]
      try {
        const saved = JSON.parse(localStorage.getItem(key))
        api.get(`/api/sessions/${saved.code}/info`)
          .then(res => {
            if (res.data.status === 'active') {
              setSessionCode(saved.code)
              setParticipantName(saved.name || '')
              setParticipantGroup(saved.group || '')
              // Only (re)join a team once one has been chosen. The join marker is
              // written on "Before you start"; before that the device has a code
              // but no group, and session:join requires a group.
              if (saved.group) {
                participantDataRef.current = { code: saved.code, name: saved.name, group: saved.group }
                socket.emit('session:join', {
                  code:  saved.code,
                  name:  saved.name,
                  group: saved.group,
                })
              }
            } else {
              localStorage.removeItem(key)
            }
          })
          .catch(() => localStorage.removeItem(key))
      } catch {
        localStorage.removeItem(key)
      }
    }

    return () => {
      socket.off('session:closed')
      socket.off('connect', onConnect)
      socket.disconnect()
    }
  }, [])

  function joinSession(code, name, group) {
    participantDataRef.current = { code, name, group }
    setSessionCode(code)
    setParticipantName(name)
    setParticipantGroup(group)
    setSessionClosed(false)
    socket.emit('session:join', { code, name, group })
  }

  function clearSession() {
    // Wipe ALL participant-flow keys so a reused device never leaks the previous
    // participant's progress or result. Prefix-based so new ports_* keys are
    // covered automatically (participant, par pending/progress/result).
    const PREFIXES = ['ports_participant_', 'ports_par_']
    Object.keys(localStorage)
      .filter(k => PREFIXES.some(p => k.startsWith(p)))
      .forEach(k => localStorage.removeItem(k))
    setSessionCode(null)
    setParticipantName('')
    setParticipantGroup('')
    setSessionClosed(false)
    socket.disconnect()
    socket.connect()
  }

  return (
    <SessionContext.Provider value={{
      sessionCode,
      participantName,
      participantGroup,
      sessionClosed,
      joinSession,
      clearSession,
    }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
