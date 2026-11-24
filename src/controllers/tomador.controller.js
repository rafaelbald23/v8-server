import pool from '../config/db.js'

// ── GET /api/tomador/perfil ───────────────────────────────────
export async function getPerfil(req, res) {
  try {
    const result = await pool.query(
      `SELECT
         u.id, u.name, u.email, u.role, u.ativo, u.status, u.avatar_url,
         p.cpf_cnpj, p.tipo_pessoa, p.data_nascimento, p.telefone, p.whatsapp,
         p.cep, p.logradouro, p.numero, p.complemento, p.bairro, p.cidade, p.estado,
         p.profissao, p.empresa_empregadora, p.renda_declarada, p.tempo_emprego_meses,
         p.finalidade_credito
       FROM users u
       LEFT JOIN tomador_perfil p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    )
    if (!result.rows.length)
      return res.status(404).json({ error: 'Tomador não encontrado' })

    res.json({ perfil: result.rows[0] })
  } catch (e) {
    console.error('[TOMADOR] getPerfil:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── PUT /api/tomador/perfil ───────────────────────────────────
export async function upsertPerfil(req, res) {
  const {
    cpf_cnpj, tipo_pessoa, data_nascimento, telefone, whatsapp,
    cep, logradouro, numero, complemento, bairro, cidade, estado,
    profissao, empresa_empregadora, renda_declarada, tempo_emprego_meses,
    finalidade_credito,
  } = req.body

  // Validações básicas
  if (cpf_cnpj) {
    const digits = cpf_cnpj.replace(/\D/g, '')
    if (digits.length !== 11 && digits.length !== 14)
      return res.status(400).json({ error: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos' })
  }

  if (tipo_pessoa && !['pf', 'pj'].includes(tipo_pessoa))
    return res.status(400).json({ error: 'tipo_pessoa deve ser pf ou pj' })

  try {
    // Atualiza nome se vier no body
    if (req.body.name) {
      await pool.query('UPDATE users SET name = $1 WHERE id = $2', [req.body.name.trim(), req.user.id])
    }

    const result = await pool.query(
      `INSERT INTO tomador_perfil (
         user_id, cpf_cnpj, tipo_pessoa, data_nascimento, telefone, whatsapp,
         cep, logradouro, numero, complemento, bairro, cidade, estado,
         profissao, empresa_empregadora, renda_declarada, tempo_emprego_meses,
         finalidade_credito
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (user_id) DO UPDATE SET
         cpf_cnpj            = EXCLUDED.cpf_cnpj,
         tipo_pessoa         = EXCLUDED.tipo_pessoa,
         data_nascimento     = EXCLUDED.data_nascimento,
         telefone            = EXCLUDED.telefone,
         whatsapp            = EXCLUDED.whatsapp,
         cep                 = EXCLUDED.cep,
         logradouro          = EXCLUDED.logradouro,
         numero              = EXCLUDED.numero,
         complemento         = EXCLUDED.complemento,
         bairro              = EXCLUDED.bairro,
         cidade              = EXCLUDED.cidade,
         estado              = EXCLUDED.estado,
         profissao           = EXCLUDED.profissao,
         empresa_empregadora = EXCLUDED.empresa_empregadora,
         renda_declarada     = EXCLUDED.renda_declarada,
         tempo_emprego_meses = EXCLUDED.tempo_emprego_meses,
         finalidade_credito  = EXCLUDED.finalidade_credito,
         atualizado_em       = NOW()
       RETURNING *`,
      [
        req.user.id, cpf_cnpj || null, tipo_pessoa || null,
        data_nascimento || null, telefone || null, whatsapp || null,
        cep || null, logradouro || null, numero || null,
        complemento || null, bairro || null, cidade || null, estado || null,
        profissao || null, empresa_empregadora || null,
        renda_declarada || null, tempo_emprego_meses || null,
        finalidade_credito || null,
      ]
    )

    res.json({ perfil: result.rows[0] })
  } catch (e) {
    console.error('[TOMADOR] upsertPerfil:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── GET /api/tomador/status ───────────────────────────────────
// Retorna o status de onboarding do tomador
export async function getStatus(req, res) {
  try {
    const user = await pool.query(
      'SELECT id, name, email, ativo, status FROM users WHERE id = $1',
      [req.user.id]
    )
    const perfil = await pool.query(
      'SELECT * FROM tomador_perfil WHERE user_id = $1',
      [req.user.id]
    )
    const docs = await pool.query(
      'SELECT tipo, status FROM tomador_documentos WHERE user_id = $1',
      [req.user.id]
    )
    const pagamento = await pool.query(
      `SELECT po.status FROM payment_orders po
       JOIN servicos s ON s.id = po.servico_id
       WHERE po.user_id = $1 AND s.codigo = 'TAXA_CADASTRO'
       ORDER BY po.criado_em DESC LIMIT 1`,
      [req.user.id]
    )

    res.json({
      usuario:         user.rows[0],
      perfil_completo: perfil.rows.length > 0,
      documentos:      docs.rows,
      taxa_paga:       pagamento.rows[0]?.status === 'pago',
    })
  } catch (e) {
    console.error('[TOMADOR] getStatus:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}
