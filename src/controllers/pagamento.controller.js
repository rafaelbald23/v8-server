import pool from '../config/db.js'

// ── GET /api/pagamento/taxa — status da taxa de cadastro ──────
export async function statusTaxa(req, res) {
  try {
    // Busca o serviço TAXA_CADASTRO
    const servico = await pool.query(
      `SELECT * FROM servicos WHERE codigo = 'TAXA_CADASTRO' AND ativo = true`
    )
    if (!servico.rows.length)
      return res.status(404).json({ error: 'Serviço TAXA_CADASTRO não configurado' })

    // Busca a última payment_order deste usuário para este serviço
    const order = await pool.query(
      `SELECT po.* FROM payment_orders po
       WHERE po.user_id = $1 AND po.servico_id = $2
       ORDER BY po.criado_em DESC LIMIT 1`,
      [req.user.id, servico.rows[0].id]
    )

    res.json({
      servico:  servico.rows[0],
      order:    order.rows[0] || null,
      pago:     order.rows[0]?.status === 'pago',
    })
  } catch (e) {
    console.error('[PAG] statusTaxa:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── POST /api/pagamento/taxa — cria cobrança Pix ──────────────
export async function criarCobrancaTaxa(req, res) {
  try {
    const servico = await pool.query(
      `SELECT * FROM servicos WHERE codigo = 'TAXA_CADASTRO' AND ativo = true`
    )
    if (!servico.rows.length)
      return res.status(404).json({ error: 'Serviço não configurado' })

    const s = servico.rows[0]

    // Verifica se já tem uma cobrança pendente válida
    const existente = await pool.query(
      `SELECT * FROM payment_orders
       WHERE user_id = $1 AND servico_id = $2 AND status = 'pendente'
       AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY criado_em DESC LIMIT 1`,
      [req.user.id, s.id]
    )
    if (existente.rows.length > 0) {
      return res.json({ order: existente.rows[0], reaproveitado: true })
    }

    // Verifica se já pagou
    const pago = await pool.query(
      `SELECT id FROM payment_orders
       WHERE user_id = $1 AND servico_id = $2 AND status = 'pago'`,
      [req.user.id, s.id]
    )
    if (pago.rows.length > 0)
      return res.status(409).json({ error: 'Taxa já paga', code: 'ALREADY_PAID' })

    // ── Simulação de gateway (substituir por Asaas/Mercado Pago no Sprint 4) ──
    const gatewayId    = `SIM-${Date.now()}`
    const pixCopiaCola = `00020126580014BR.GOV.BCB.PIX0136${req.user.id}5204000053039865406${Number(s.valor).toFixed(2).replace('.', '')}5802BR5913V8 Exclusive6009SAO PAULO62070503***6304ABCD`
    const pixQrCode    = `data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="white"/><text x="100" y="100" text-anchor="middle" font-size="12" fill="#333">QR Code Simulado</text><text x="100" y="120" text-anchor="middle" font-size="10" fill="#666">R$ ${s.valor}</text></svg>`).toString('base64')}`
    const expiresAt    = new Date(Date.now() + 30 * 60 * 1000) // 30 min

    const r = await pool.query(
      `INSERT INTO payment_orders
         (user_id, servico_id, valor, status, gateway, gateway_id, pix_qr_code, pix_copia_cola, expires_at)
       VALUES ($1,$2,$3,'pendente','simulado',$4,$5,$6,$7)
       RETURNING *`,
      [req.user.id, s.id, s.valor, gatewayId, pixQrCode, pixCopiaCola, expiresAt]
    )

    res.status(201).json({ order: r.rows[0], reaproveitado: false })
  } catch (e) {
    console.error('[PAG] criarCobrancaTaxa:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── GET /api/pagamento/:orderId/status — polling de status ────
export async function statusOrder(req, res) {
  try {
    const r = await pool.query(
      `SELECT po.*, s.codigo as servico_codigo, s.nome as servico_nome
       FROM payment_orders po
       JOIN servicos s ON s.id = po.servico_id
       WHERE po.id = $1 AND po.user_id = $2`,
      [req.params.orderId, req.user.id]
    )
    if (!r.rows.length)
      return res.status(404).json({ error: 'Cobrança não encontrada' })

    res.json({ order: r.rows[0] })
  } catch (e) {
    console.error('[PAG] statusOrder:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── POST /api/pagamento/webhook — recebe confirmação do gateway
// (Versão real: validar assinatura HMAC do gateway)
export async function webhook(req, res) {
  const { gateway_id, status, pago_em } = req.body

  if (!gateway_id || !status)
    return res.status(400).json({ error: 'Payload inválido' })

  try {
    const order = await pool.query(
      `SELECT * FROM payment_orders WHERE gateway_id = $1`,
      [gateway_id]
    )
    if (!order.rows.length)
      return res.status(404).json({ error: 'Cobrança não encontrada' })

    const o = order.rows[0]

    if (status === 'pago') {
      await pool.query(
        `UPDATE payment_orders SET status = 'pago', pago_em = $1 WHERE id = $2`,
        [pago_em || new Date(), o.id]
      )

      // Ativa o tomador ao pagar a taxa de cadastro
      const servico = await pool.query(
        `SELECT codigo FROM servicos WHERE id = $1`, [o.servico_id]
      )
      if (servico.rows[0]?.codigo === 'TAXA_CADASTRO') {
        await pool.query(
          `UPDATE users SET ativo = true, status = 'ativo' WHERE id = $1`,
          [o.user_id]
        )
        // Registra no ledger
        await pool.query(
          `INSERT INTO ledger (tipo, referencia_id, referencia_tipo, valor, descricao)
           VALUES ('receita_taxa', $1, 'payment_order', $2, 'Taxa de cadastro')`,
          [o.id, o.valor]
        )
      }
    }

    res.json({ ok: true })
  } catch (e) {
    console.error('[PAG] webhook:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── POST /api/pagamento/:orderId/simular-pagamento ────────────
// Apenas em desenvolvimento — simula a confirmação de pagamento
export async function simularPagamento(req, res) {
  if (process.env.NODE_ENV === 'production')
    return res.status(403).json({ error: 'Não disponível em produção' })

  try {
    const order = await pool.query(
      `SELECT * FROM payment_orders WHERE id = $1 AND user_id = $2`,
      [req.params.orderId, req.user.id]
    )
    if (!order.rows.length)
      return res.status(404).json({ error: 'Cobrança não encontrada' })

    const o = order.rows[0]

    await pool.query(
      `UPDATE payment_orders SET status = 'pago', pago_em = NOW() WHERE id = $1`,
      [o.id]
    )

    const servico = await pool.query(`SELECT codigo FROM servicos WHERE id = $1`, [o.servico_id])
    if (servico.rows[0]?.codigo === 'TAXA_CADASTRO') {
      await pool.query(
        `UPDATE users SET ativo = true, status = 'ativo' WHERE id = $1`,
        [o.user_id]
      )
      await pool.query(
        `INSERT INTO ledger (tipo, referencia_id, referencia_tipo, valor, descricao)
         VALUES ('receita_taxa', $1, 'payment_order', $2, 'Taxa de cadastro (simulado)')`,
        [o.id, o.valor]
      )
    }

    res.json({ ok: true, message: 'Pagamento simulado com sucesso' })
  } catch (e) {
    console.error('[PAG] simular:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}
