import pool from '../config/db.js'

// ── GET /api/investidor/dashboard ────────────────────────────
export async function dashboardInvestidor(req, res) {
  const uid = req.user.id
  try {
    const [
      carteiraRes,
      evolucaoRes,
      proximasRes,
      vencidasRes,
      recentesRes,
    ] = await Promise.all([

      // Visão geral da carteira
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'ativo')           AS contratos_ativos,
           COUNT(*) FILTER (WHERE status = 'inadimplente')    AS contratos_inadimplentes,
           COUNT(*) FILTER (WHERE status = 'quitado')         AS contratos_quitados,
           COUNT(*)                                            AS contratos_total,
           COALESCE(SUM(valor) FILTER (WHERE status IN ('ativo','inadimplente')), 0) AS valor_na_rua,
           COALESCE(SUM(valor) FILTER (WHERE status = 'quitado'), 0)                AS valor_recuperado,
           COALESCE(SUM(valor * taxa_juros_mes * prazo_meses)
             FILTER (WHERE status = 'ativo'), 0)              AS retorno_esperado_total,
           COALESCE(SUM(valor * taxa_v8)
             FILTER (WHERE status IN ('ativo','quitado')), 0) AS taxa_v8_total
         FROM contratos WHERE investidor_id = $1`,
        [uid]
      ),

      // Evolução mensal dos últimos 6 meses (recebimentos)
      pool.query(
        `SELECT
           TO_CHAR(p.pago_em, 'YYYY-MM') AS mes,
           COALESCE(SUM(p.valor_pago), 0) AS recebido,
           COUNT(*)                        AS parcelas_pagas
         FROM parcelas p
         JOIN contratos c ON c.id = p.contrato_id
         WHERE c.investidor_id = $1
           AND p.status = 'paga'
           AND p.pago_em >= NOW() - INTERVAL '6 months'
         GROUP BY mes
         ORDER BY mes`,
        [uid]
      ),

      // Próximas cobranças (vence hoje e amanhã)
      pool.query(
        `SELECT
           p.id, p.numero, p.valor, p.vencimento, p.status,
           u.name AS tomador_nome, u.id AS tomador_id,
           c.id AS contrato_id, c.valor AS contrato_valor
         FROM parcelas p
         JOIN contratos c ON c.id = p.contrato_id
         JOIN users u ON u.id = c.tomador_id
         WHERE c.investidor_id = $1
           AND p.status = 'aberta'
           AND p.vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 1
         ORDER BY p.vencimento`,
        [uid]
      ),

      // Parcelas vencidas (inadimplência)
      pool.query(
        `SELECT
           p.id, p.numero, p.valor, p.vencimento, p.status,
           u.name AS tomador_nome, u.id AS tomador_id,
           c.id AS contrato_id,
           CURRENT_DATE - p.vencimento AS dias_atraso
         FROM parcelas p
         JOIN contratos c ON c.id = p.contrato_id
         JOIN users u ON u.id = c.tomador_id
         WHERE c.investidor_id = $1
           AND p.status = 'atrasada'
         ORDER BY p.vencimento ASC
         LIMIT 10`,
        [uid]
      ),

      // Contratos recentes
      pool.query(
        `SELECT
           c.id, c.valor, c.prazo_meses, c.taxa_juros_mes, c.status,
           c.desembolsado_em, c.assinado_em,
           u.name AS tomador_nome, u.id AS tomador_id
         FROM contratos c
         JOIN users u ON u.id = c.tomador_id
         WHERE c.investidor_id = $1
         ORDER BY c.criado_em DESC
         LIMIT 5`,
        [uid]
      ),
    ])

    res.json({
      carteira:        carteiraRes.rows[0],
      evolucao_mensal: evolucaoRes.rows,
      proximas_cobrancas: proximasRes.rows,
      parcelas_vencidas:  vencidasRes.rows,
      contratos_recentes: recentesRes.rows,
    })
  } catch (e) {
    console.error('[INV-DASH]', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}
