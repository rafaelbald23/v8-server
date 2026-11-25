import pool from '../config/db.js'

// ── Verifica se o usuário está ativo no banco ─────────────────
// Usado depois do auth() para garantir que a conta não foi
// suspensa/bloqueada após o token ser emitido.
export async function requireAtivo(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT ativo, status FROM users WHERE id = $1',
      [req.user.id]
    )
    const user = result.rows[0]

    if (!user)
      return res.status(401).json({ error: 'Usuário não encontrado' })

    if (!user.ativo || user.status === 'bloqueado')
      return res.status(403).json({
        error: 'Conta bloqueada ou inativa',
        code: 'ACCOUNT_INACTIVE',
      })

    if (user.status === 'suspenso')
      return res.status(403).json({
        error: 'Conta suspensa',
        code: 'ACCOUNT_SUSPENDED',
      })

    next()
  } catch (e) {
    console.error('[requireAtivo]', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}
