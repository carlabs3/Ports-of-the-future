import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const router = Router()

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' })
    }
    const hash = await bcrypt.hash(password, 10)
    const user = await User.create({ email, password: hash })
    res.status(201).json({ message: 'Facilitador creado', id: user._id })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email ya registrado' })
    res.status(500).json({ error: 'Error del servidor' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' })
    }
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' })

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )
    res.json({ token, email: user.email })
  } catch {
    res.status(500).json({ error: 'Error del servidor' })
  }
})

export default router
