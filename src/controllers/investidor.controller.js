import pool from '../config/db.js'

// ── GET /api/investidor/perfil ────────────────────────────────
export async function getPerfil(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         u.id, u.name, u.email, u.role, u.ativo, u.status, u.avatar_url,
         p.cpf_cnpj, p.tipo_pessoa, p.telefone, p.whatsapp,
         p.cep, p.cidade, p.estado
       FROM users u
       LEFT JOIN investidor_perfil p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    )
    if (!result.rows.length)
      return res.status(404).json({ error: 'Investidor não encontrado' })

    res.json({ perfil: result.rows[0] })
  } catch (e) {
    console.error('[INV] getPerfil:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── PUT /api/investidor/perfil ────────────────────────────────
export async function upsertPerfil(req, res) {
  const { cpf_cnpj, tipo_pessoa, telefone, whatsapp, cep, cidade, estado } = req.body

  if (tipo_pessoa && !['pf', 'pj'].includes(tipo_pessoa))
    return res.status(400).json({ error: 'tipo_pessoa deve ser pf ou pj' })

  try {
    if (req.body.name) {
      await pool.query('UPDATE users SET name = $1 WHERE id = $2', [req.body.name.trim(), req.user.id])
    }

    const r = await pool.query(
      `INSERT INTO investidor_perfil (user_id, cpf_cnpj, tipo_pessoa, telefone, whatsapp, cep, cidade, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id) DO UPDATE SET
         cpf_cnpj    = EXCLUDED.cpf_cnpj,
         tipo_pessoa = EXCLUDED.tipo_pessoa,
         telefone    = EXCLUDED.telefone,
         whatsapp    = EXCLUDED.whatsapp,
         cep         = EXCLUDED.cep,
         cidade      = EXCLUDED.cidade,
         estado      = EXCLUDED.estado,
         atualizado_em = NOW()
       RETURNING *`,
      [req.user.id, cpf_cnpj || null, tipo_pessoa || null,
       telefone || null, whatsapp || null, cep || null, cidade || null, estado || null]
    )
    res.json({ perfil: r.rows[0] })
  } catch (e) {
    console.error('[INV] upsertPerfil:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── GET /api/investidor/resumo ────────────────────────────────
// Resumo financeiro: contratos ativos, valor na rua, retorno esperado
export async function getResumo(req, res) {
  try {
    const [contratosRes, parcelasRes] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'ativo')       AS contratos_ativos,
           COUNT(*) FILTER (WHERE status = 'inadimplente') AS contratos_inadimplentes,
           COUNT(*) FILTER (WHERE status = 'quitado')     AS contratos_quitados,
           COALESCE(SUM(valor) FILTER (WHERE status IN ('ativo','inadimplente')), 0) AS valor_na_rua,
           COALESCE(SUM(valor * taxa_juros_mes * prazo_meses) FILTER (WHERE status = 'ativo'), 0) AS retorno_esperado
         FROM contratos WHERE investidor_id = $1`,
        [req.user.id]
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE p.status = 'atrasada') AS parcelas_atrasadas,
           COALESCE(SUM(p.valor) FILTER (WHERE p.status = 'atrasada'), 0) AS valor_atrasado,
           COUNT(*) FILTER (WHERE p.vencimento = CURRENT_DATE) AS vence_hoje,
           COUNT(*) FILTER (WHERE p.vencimento = CURRENT_DATE + 1) AS vence_amanha
         FROM parcelas p
         JOIN contratos c ON c.id = p.contrato_id
         WHERE c.investidor_id = $1 AND p.status != 'paga'`,
        [req.user.id]
      ),
    ])

    res.json({
      carteira: contratosRes.rows[0],
      cobrancas: parcelasRes.rows[0],
    })
  } catch (e) {
    console.error('[INV] getResumo:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}
