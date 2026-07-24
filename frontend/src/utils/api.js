import axios from 'axios'
import { BACKEND_URL } from './config.js'

const api = axios.create({
  baseURL: BACKEND_URL,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
