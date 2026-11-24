import pool from '../config/db.js'

const TIPOS_VALIDOS = [
  'cadastro',
  'analise_credito',
  'open_finance',
  'comunicacao',
  'compartilhamento_dados',
]

// Consentimentos obrigatórios para o tomador prosseguir
const OBRIGATORIOS = ['cadastro', 'analise_credito']

// ── GET /api/lgpd ─────────────────────────────────────────────
export async function listar(req, res) {
  try {
    const r = await pool.query(
      `SELECT tipo, aceito, versao, ip, criado_em
       FROM consentimentos
       WHERE user_id = $1
       ORDER BY criado_em DESC`,
      [req.user.id]
    )
    res.json({ consentimentos: r.rows })
  } catch (e) {
    console.error('[LGPD] listar:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── GET /api/lgpd/status ──────────────────────────────────────
// Retorna quais consentimentos foram aceitos e se os obrigatórios estão ok
export async function status(req, res) {
  try {
    // Pega o último consentimento por tipo (pode ter histórico de revogações)
    const r = await pool.query(
      `SELECT DISTINCT ON (tipo) tipo, aceito, versao, criado_em
       FROM consentimentos
       WHERE user_id = $1
       ORDER BY tipo, criado_em DESC`,
      [req.user.id]
    )

    const mapa = Object.fromEntries(r.rows.map(c => [c.tipo, c]))
    const pendentes = OBRIGATORIOS.filter(t => !mapa[t]?.aceito)

    res.json({
      consentimentos: mapa,
      obrigatorios_pendentes: pendentes,
      pode_prosseguir: pendentes.length === 0,
    })
  } catch (e) {
    console.error('[LGPD] status:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── POST /api/lgpd ────────────────────────────────────────────
// Registra um ou mais consentimentos de uma vez
export async function registrar(req, res) {
  const { consentimentos } = req.body // [{ tipo, aceito }]

  if (!Array.isArray(consentimentos) || consentimentos.length === 0)
    return res.status(400).json({ error: 'Envie um array de consentimentos' })

  for (const c of consentimentos) {
    if (!TIPOS_VALIDOS.includes(c.tipo))
      return res.status(400).json({ error: `Tipo inválido: ${c.tipo}. Use: ${TIPOS_VALIDOS.join(', ')}` })
    if (typeof c.aceito !== 'boolean')
      return res.status(400).json({ error: `Campo aceito deve ser boolean para tipo: ${c.tipo}` })
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress
  const userAgent = req.headers['user-agent'] || ''

  try {
    const inseridos = []
    for (const c of consentimentos) {
      const r = await pool.query(
        `INSERT INTO consentimentos (user_id, tipo, aceito, versao, ip, user_agent)
         VALUES ($1, $2, $3, '1.0', $4, $5) RETURNING *`,
        [req.user.id, c.tipo, c.aceito, ip, userAgent]
      )
      inseridos.push(r.rows[0])
    }
    res.status(201).json({ consentimentos: inseridos })
  } catch (e) {
    console.error('[LGPD] registrar:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── DELETE /api/lgpd/:tipo ────────────────────────────────────
// Revoga um consentimento (insere registro com aceito=false)
export async function revogar(req, res) {
  const { tipo } = req.params

  if (!TIPOS_VALIDOS.includes(tipo))
    return res.status(400).json({ error: `Tipo inválido: ${tipo}` })

  if (OBRIGATORIOS.includes(tipo))
    return res.status(400).json({
      error: 'Este consentimento é obrigatório e não pode ser revogado pela plataforma',
      code: 'CONSENT_REQUIRED',
    })

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress

  try {
    await pool.query(
      `INSERT INTO consentimentos (user_id, tipo, aceito, versao, ip)
       VALUES ($1, $2, false, '1.0', $3)`,
      [req.user.id, tipo, ip]
    )
    res.json({ ok: true, tipo, aceito: false })
  } catch (e) {
    console.error('[LGPD] revogar:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}
