import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const email = localStorage.getItem('user_email')
    return email ? { email } : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('token') || null)

  function login(newToken, email) {
    localStorage.setItem('token', newToken)
    localStorage.setItem('user_email', email)
    setToken(newToken)
    setUser({ email })
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user_email')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
