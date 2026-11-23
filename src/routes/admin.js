import { Router } from 'express'
import { auth } from '../middlewares/auth.js'
import { isAdmin } from '../middlewares/roles.js'
import { requireAtivo } from '../middlewares/requireAtivo.js'
import pool from '../config/db.js'

const router = Router()

// Todas as rotas admin exigem: token válido + role admin + conta ativa
router.use(auth, requireAtivo, isAdmin)

// GET /api/admin/users — lista todos os usuários
router.get('/users', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, ativo, status, criado_em
       FROM users ORDER BY criado_em DESC`
    )
    res.json({ users: result.rows })
  } catch (e) {
    console.error('[ADMIN] users error:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// GET /api/admin/users/:id — detalhe de um usuário
router.get('/users/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role, ativo, status, avatar_url, criado_em, atualizado_em
       FROM users WHERE id = $1`,
      [req.params.id]
    )
    if (!result.rows.length)
      return res.status(404).json({ error: 'Usuário não encontrado' })
    res.json({ user: result.rows[0] })
  } catch (e) {
    console.error('[ADMIN] user detail error:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// PATCH /api/admin/users/:id/status — altera status (ativo/suspenso/bloqueado)
router.patch('/users/:id/status', async (req, res) => {
  const { status, ativo } = req.body
  const allowed = ['pendente', 'ativo', 'suspenso', 'bloqueado']

  if (status && !allowed.includes(status))
    return res.status(400).json({ error: `Status inválido. Use: ${allowed.join(', ')}` })

  try {
    const fields = []
    const values = []
    let i = 1

    if (status !== undefined) { fields.push(`status = $${i++}`); values.push(status) }
    if (ativo  !== undefined) { fields.push(`ativo = $${i++}`);  values.push(ativo) }

    if (!fields.length)
      return res.status(400).json({ error: 'Nenhum campo para atualizar' })

    values.push(req.params.id)
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, email, role, ativo, status`,
      values
    )
    if (!result.rows.length)
      return res.status(404).json({ error: 'Usuário não encontrado' })

    res.json({ user: result.rows[0] })
  } catch (e) {
    console.error('[ADMIN] status update error:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
})

export default router
