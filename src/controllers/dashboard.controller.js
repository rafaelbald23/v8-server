import pool from '../config/db.js'

// ── GET /api/tomador/dashboard ────────────────────────────────
// Retorna tudo que o dashboard precisa em uma única chamada
export async function dashboardTomador(req, res) {
  const uid = req.user.id
  try {
    const [userRes, perfilRes, docsRes, contatosRes, lgpdRes, pagRes, solRes] = await Promise.all([
      pool.query('SELECT id, name, email, ativo, status, criado_em FROM users WHERE id=$1', [uid]),

      pool.query('SELECT * FROM tomador_perfil WHERE user_id=$1', [uid]),

      pool.query(
        `SELECT tipo, status, COUNT(*) as total
         FROM tomador_documentos WHERE user_id=$1
         GROUP BY tipo, status`,
        [uid]
      ),

      pool.query('SELECT COUNT(*) as total FROM tomador_contatos WHERE user_id=$1', [uid]),

      pool.query(
        `SELECT DISTINCT ON (tipo) tipo, aceito
         FROM consentimentos WHERE user_id=$1
         ORDER BY tipo, criado_em DESC`,
        [uid]
      ),

      pool.query(
        `SELECT po.status, po.valor, po.pago_em
         FROM payment_orders po
         JOIN servicos s ON s.id = po.servico_id
         WHERE po.user_id=$1 AND s.codigo='TAXA_CADASTRO'
         ORDER BY po.criado_em DESC LIMIT 1`,
        [uid]
      ),

      pool.query(
        `SELECT id, valor_solicitado, prazo_meses, status, criado_em
         FROM solicitacoes WHERE tomador_id=$1
         ORDER BY criado_em DESC LIMIT 5`,
        [uid]
      ),
    ])

    const user     = userRes.rows[0]
    const perfil   = perfilRes.rows[0]  || null
    const docs     = docsRes.rows
    const contatos = Number(contatosRes.rows[0]?.total || 0)
    const lgpd     = lgpdRes.rows
    const taxa     = pagRes.rows[0]    || null
    const solicitacoes = solRes.rows

    // ── Calcula steps de onboarding ───────────────────────────
    const consentimentosObrig = lgpd.filter(c =>
      ['cadastro','analise_credito'].includes(c.tipo) && c.aceito
    ).length

    const steps = [
      {
        id:        'cadastro',
        label:     'Dados cadastrais',
        completo:  !!(perfil?.cpf_cnpj && perfil?.telefone && perfil?.profissao),
        href:      '/tomador/cadastro',
      },
      {
        id:        'documentos',
        label:     'Documentos',
        completo:  docs.some(d => d.status === 'aprovado'),
        href:      '/tomador/documentos',
      },
      {
        id:        'contatos',
        label:     'Contatos e referências',
        completo:  contatos >= 2,
        href:      '/tomador/contatos',
      },
      {
        id:        'privacidade',
        label:     'Consentimentos LGPD',
        completo:  consentimentosObrig >= 2,
        href:      '/tomador/privacidade',
      },
      {
        id:        'taxa',
        label:     'Taxa de acesso',
        completo:  taxa?.status === 'pago',
        href:      '/tomador/pagamento',
      },
    ]

    const stepsCompletos = steps.filter(s => s.completo).length
    const percentual     = Math.round((stepsCompletos / steps.length) * 100)
    const podeSOlicitar  = user.ativo && stepsCompletos === steps.length

    res.json({
      user,
      perfil,
      taxa,
      solicitacoes,
      onboarding: {
        steps,
        stepsCompletos,
        total: steps.length,
        percentual,
        pode_solicitar: podeSOlicitar,
      },
      resumo: {
        docs_enviados:  docs.length,
        docs_aprovados: docs.filter(d => d.status === 'aprovado').length,
        contatos,
      },
    })
  } catch (e) {
    console.error('[DASHBOARD] tomador:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}
