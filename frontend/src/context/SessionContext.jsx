import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { socket } from '../utils/socket.js'
import api from '../utils/api.js'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [sessionCode,       setSessionCode]       = useState(null)
  const [participantName,   setParticipantName]   = useState('')
  const [participantGroup,  setParticipantGroup]  = useState('')
  const [participantAge,    setParticipantAge]    = useState('')
  const [participantGender, setParticipantGender] = useState('')
  const [currentStep,       setCurrentStep]       = useState(1)
  const [sessionClosed,     setSessionClosed]     = useState(false)

  // Keeps participant data alive so the reconnect handler can re-emit session:join
  // after a mobile screen lock / network change assigns a new socket.id
  const participantDataRef = useRef(null)

  useEffect(() => {
    socket.connect()
    socket.on('step:change', ({ step }) => setCurrentStep(step))
    socket.on('session:closed', () => setSessionClosed(true))

    // Re-join room and update socketId in backend after any reconnect
    function onConnect() {
      if (participantDataRef.current) {
        socket.emit('session:join', participantDataRef.current)
      }
    }
    socket.on('connect', onConnect)

    // Try to restore participant session from localStorage
    const keys = Object.keys(localStorage).filter(k => k.startsWith('co2sprint_participant_'))
    if (keys.length > 0) {
      const key = keys[keys.length - 1]
      try {
        const saved = JSON.parse(localStorage.getItem(key))
        api.get(`/api/sessions/${saved.code}/info`)
          .then(res => {
            if (res.data.status === 'active') {
              participantDataRef.current = { code: saved.code, name: saved.name, group: saved.group, age: saved.age, gender: saved.gender }
              setSessionCode(saved.code)
              setParticipantName(saved.name || '')
              setParticipantGroup(saved.group || '')
              setParticipantAge(saved.age || '')
              setParticipantGender(saved.gender || '')
              socket.emit('session:join', {
                code:   saved.code,
                name:   saved.name,
                group:  saved.group,
                age:    saved.age,
                gender: saved.gender,
              })
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
      socket.off('step:change')
      socket.off('session:closed')
      socket.off('connect', onConnect)
      socket.disconnect()
    }
  }, [])

  function joinSession(code, name, group, age, gender) {
    participantDataRef.current = { code, name, group, age: age || '', gender: gender || '' }
    setSessionCode(code)
    setParticipantName(name)
    setParticipantGroup(group)
    setParticipantAge(age || '')
    setParticipantGender(gender || '')
    setSessionClosed(false)
    socket.emit('session:join', { code, name, group, age, gender })
  }

  function clearSession() {
    // Clear participant and progress keys from localStorage
    Object.keys(localStorage)
      .filter(k =>
        k.startsWith('co2sprint_participant_') ||
        k.startsWith('co2sprint_progress_') ||
        k.startsWith('co2sprint_results_')
      )
      .forEach(k => localStorage.removeItem(k))
    setSessionCode(null)
    setParticipantName('')
    setParticipantGroup('')
    setParticipantAge('')
    setParticipantGender('')
    setCurrentStep(1)
    setSessionClosed(false)
    socket.disconnect()
    socket.connect()
  }

  return (
    <SessionContext.Provider value={{
      sessionCode,
      currentStep,
      participantName,
      participantGroup,
      participantAge,
      participantGender,
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
