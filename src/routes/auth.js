import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'

const router = Router()

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'Email e senha são obrigatórios' })

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND ativo = true',
      [email.toLowerCase().trim()]
    )
    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' })

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' })

    const payload = { id: user.id, role: user.role, name: user.name, email: user.email }
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })

    res.json({ token, user: payload })
  } catch (e) {
    console.error('[AUTH] login error:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
})

export default router
