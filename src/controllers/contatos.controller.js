import pool from '../config/db.js'

const TIPOS_VALIDOS  = ['familiar', 'referencia_pessoal', 'referencia_comercial']
const MINIMO_POR_TIPO = { familiar: 1, referencia_pessoal: 1, referencia_comercial: 0 }
const MAXIMO_TOTAL   = 10

// ÔöÇÔöÇ GET /api/tomador/contatos ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
export async function listar(req, res) {
  try {
    const r = await pool.query(
      `SELECT id, tipo, nome, telefone, whatsapp, relacao, criado_em
       FROM tomador_contatos WHERE user_id = $1 ORDER BY tipo, criado_em`,
      [req.user.id]
    )
    res.json({ contatos: r.rows })
  } catch (e) {
    console.error('[CONTATOS] listar:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ÔöÇÔöÇ POST /api/tomador/contatos ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
export async function criar(req, res) {
  const { tipo, nome, telefone, whatsapp, relacao } = req.body

  if (!nome || nome.trim().length < 2)
    return res.status(400).json({ error: 'Nome deve ter ao menos 2 caracteres' })

  if (!TIPOS_VALIDOS.includes(tipo))
    return res.status(400).json({ error: `Tipo inv├ílido. Use: ${TIPOS_VALIDOS.join(', ')}` })

  if (!telefone)
    return res.status(400).json({ error: 'Telefone ├® obrigat├│rio' })

  try {
    // Verifica limite total
    const total = await pool.query(
      'SELECT COUNT(*) FROM tomador_contatos WHERE user_id = $1',
      [req.user.id]
    )
    if (Number(total.rows[0].count) >= MAXIMO_TOTAL)
      return res.status(400).json({ error: `Limite de ${MAXIMO_TOTAL} contatos atingido` })

    const r = await pool.query(
      `INSERT INTO tomador_contatos (user_id, tipo, nome, telefone, whatsapp, relacao)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, tipo, nome.trim(), telefone, whatsapp || null, relacao || null]
    )
    res.status(201).json({ contato: r.rows[0] })
  } catch (e) {
    console.error('[CONTATOS] criar:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ÔöÇÔöÇ PUT /api/tomador/contatos/:id ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
export async function atualizar(req, res) {
  const { nome, telefone, whatsapp, relacao } = req.body

  try {
    const r = await pool.query(
      `UPDATE tomador_contatos SET
         nome     = COALESCE($1, nome),
         telefone = COALESCE($2, telefone),
         whatsapp = COALESCE($3, whatsapp),
         relacao  = COALESCE($4, relacao)
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [nome?.trim() || null, telefone || null, whatsapp || null, relacao || null, req.params.id, req.user.id]
    )
    if (!r.rows.length)
      return res.status(404).json({ error: 'Contato n├úo encontrado' })

    res.json({ contato: r.rows[0] })
  } catch (e) {
    console.error('[CONTATOS] atualizar:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ÔöÇÔöÇ DELETE /api/tomador/contatos/:id ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
export async function remover(req, res) {
  try {
    const r = await pool.query(
      'DELETE FROM tomador_contatos WHERE id = $1 AND user_id = $2 RETURNING tipo',
      [req.params.id, req.user.id]
    )
    if (!r.rows.length)
      return res.status(404).json({ error: 'Contato n├úo encontrado' })

    res.json({ ok: true })
  } catch (e) {
    console.error('[CONTATOS] remover:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ÔöÇÔöÇ GET /api/tomador/contatos/validar ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
// Verifica se o m├¡nimo de contatos por tipo foi atendido
export async function validar(req, res) {
  try {
    const r = await pool.query(
      `SELECT tipo, COUNT(*) as total
       FROM tomador_contatos WHERE user_id = $1 GROUP BY tipo`,
      [req.user.id]
    )

    const counts = Object.fromEntries(r.rows.map(row => [row.tipo, Number(row.total)]))
    const pendencias = []

    for (const [tipo, minimo] of Object.entries(MINIMO_POR_TIPO)) {
      if (minimo > 0 && (counts[tipo] || 0) < minimo) {
        const labels = { familiar: 'familiar', referencia_pessoal: 'refer├¬ncia pessoal', referencia_comercial: 'refer├¬ncia comercial' }
        pendencias.push(`Adicione ao menos ${minimo} contato ${labels[tipo]}`)
      }
    }

    res.json({ valido: pendencias.length === 0, pendencias, counts })
  } catch (e) {
    console.error('[CONTATOS] validar:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}
