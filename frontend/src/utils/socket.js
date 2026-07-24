import { io } from 'socket.io-client'
import { BACKEND_URL } from './config.js'

export const socket = io(BACKEND_URL, {
  autoConnect: false,
})
