import bcrypt from 'bcryptjs'
import pool from '../config/db.js'
import { signToken } from '../utils/jwt.js'
import { isValidEmail, isValidPassword, sanitizeEmail } from '../utils/validators.js'

// ── POST /api/auth/register ───────────────────────────────────
export async function register(req, res) {
  const { name, email, password, role } = req.body

  if (!name || typeof name !== 'string' || name.trim().length < 2)
    return res.status(400).json({ error: 'Nome deve ter ao menos 2 caracteres' })

  if (!isValidEmail(email))
    return res.status(400).json({ error: 'Email inválido' })

  if (!isValidPassword(password))
    return res.status(400).json({
      error: 'Senha deve ter no mínimo 8 caracteres, com letras e números',
    })

  const allowedRoles = ['tomador', 'investidor']
  const userRole = allowedRoles.includes(role) ? role : 'tomador'

  try {
    const cleanEmail = sanitizeEmail(email)

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [cleanEmail])
    if (existing.rows.length > 0)
      return res.status(409).json({ error: 'Email já cadastrado' })

    const password_hash = await bcrypt.hash(password, 10)

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, ativo, status)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, name, email, role, ativo, status, criado_em`,
      [
        name.trim(), cleanEmail, password_hash, userRole,
        userRole === 'investidor',
        userRole === 'investidor' ? 'ativo' : 'pendente',
      ]
    )

    const user = result.rows[0]
    const token = signToken({ id: user.id, role: user.role, name: user.name, email: user.email })

    res.status(201).json({ token, user })
  } catch (e) {
    console.error('[AUTH] register:', e.message)
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
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail])
    const user = result.rows[0]

    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' })

    const ok = await bcrypt.compare(password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Credenciais inválidas' })

    // Conta suspensa/bloqueada não pode entrar
    if (['suspenso', 'bloqueado'].includes(user.status))
      return res.status(403).json({
        error: `Conta ${user.status}. Entre em contato com o suporte.`,
        code: 'ACCOUNT_BLOCKED',
      })

    const payload = { id: user.id, role: user.role, name: user.name, email: user.email }
    const token   = signToken(payload)

    // Retorna o status do onboarding junto — o frontend decide o redirect
    res.json({
      token,
      user: payload,
      onboarding: {
        ativo:  user.ativo,
        status: user.status,  // 'pendente' | 'ativo' | 'suspenso' | 'bloqueado'
      },
    })
  } catch (e) {
    console.error('[AUTH] login:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────
export async function me(req, res) {
  try {
    // Busca o status de onboarding atualizado do banco
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.ativo, u.status,
              (SELECT status FROM payment_orders po
               JOIN servicos s ON s.id = po.servico_id
               WHERE po.user_id = u.id AND s.codigo = 'TAXA_CADASTRO'
               ORDER BY po.criado_em DESC LIMIT 1) AS taxa_status
       FROM users u WHERE u.id = $1`,
      [req.user.id]
    )
    const user = result.rows[0]
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })

    res.json({
      user,
      onboarding: {
        ativo:       user.ativo,
        status:      user.status,
        taxa_status: user.taxa_status || null,
      },
    })
  } catch (e) {
    console.error('[AUTH] me:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────
export function logout(_req, res) {
  res.json({ message: 'Logout realizado com sucesso' })
}
