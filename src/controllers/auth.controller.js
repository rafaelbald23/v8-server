import bcrypt from 'bcryptjs'
import pool from '../config/db.js'
import { signToken } from '../utils/jwt.js'
import { isValidEmail, isValidPassword, sanitizeEmail } from '../utils/validators.js'

// ── POST /api/auth/register ───────────────────────────────────
export async function register(req, res) {
  const { name, email, password, role } = req.body

  // Validações
  if (!name || typeof name !== 'string' || name.trim().length < 2)
    return res.status(400).json({ error: 'Nome deve ter ao menos 2 caracteres' })

  if (!isValidEmail(email))
    return res.status(400).json({ error: 'Email inválido' })

  if (!isValidPassword(password))
    return res.status(400).json({
      error: 'Senha deve ter no mínimo 8 caracteres, com letras e números',
    })

  // Apenas tomador e investidor podem se auto-cadastrar
  const allowedRoles = ['tomador', 'investidor']
  const userRole = allowedRoles.includes(role) ? role : 'tomador'

  try {
    const cleanEmail = sanitizeEmail(email)

    // Verifica duplicidade
    const existing = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [cleanEmail]
    )
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Email já cadastrado' })

    const password_hash = await bcrypt.hash(password, 10)

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, ativo, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, ativo, status, criado_em`,
      [
        name.trim(),
        cleanEmail,
        password_hash,
        userRole,
        // tomador só ativa após pagar a taxa (Sprint 4)
        // investidor ativa imediatamente
        userRole === 'investidor',
        userRole === 'investidor' ? 'ativo' : 'pendente',
      ]
    )

    const user = result.rows[0]
    const token = signToken({ id: user.id, role: user.role, name: user.name, email: user.email })

    res.status(201).json({ token, user })
  } catch (e) {
    console.error('[AUTH] register error:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── POST /api/auth/login ──────────────────────────────────────
export async function login(req, res) {
  const { email, password } = req.body

  if (!isValidEmail(email))
    return res.status(400).json({ error: 'Email inválido' })

  if (!password)
    return res.status(400).json({ error: 'Senha é obrigatória' })

  try {
    const cleanEmail = sanitizeEmail(email)

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [cleanEmail]
    )
    const user = result.rows[0]

    // Resposta genérica para não revelar se o email existe
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' })

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' })

    if (!user.ativo)
      return res.status(403).json({
        error: 'Conta pendente de ativação',
        code: 'ACCOUNT_PENDING',
      })

    const payload = { id: user.id, role: user.role, name: user.name, email: user.email }
    const token = signToken(payload)

    res.json({ token, user: payload })
  } catch (e) {
    console.error('[AUTH] login error:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────
export async function me(req, res) {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, ativo, status, criado_em FROM users WHERE id = $1',
      [req.user.id]
    )
    const user = result.rows[0]
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })

    res.json({ user })
  } catch (e) {
    console.error('[AUTH] me error:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────
// Stateless JWT: o logout é client-side (descarta o token)
// Aqui apenas confirmamos o recebimento para o frontend
export function logout(_req, res) {
  res.json({ message: 'Logout realizado com sucesso' })
}
