import pool from '../config/db.js'
import path from 'path'
import { unlink } from 'fs/promises'

const TIPOS_VALIDOS = [
  'rg_frente','rg_verso','cnh_frente','cnh_verso',
  'cpf','cnpj','comprovante_residencia',
  'comprovante_renda','extrato_bancario','outros',
]

// ── GET /api/tomador/documentos ───────────────────────────────
export async function listar(req, res) {
  try {
    const r = await pool.query(
      `SELECT id, tipo, nome_arquivo, tamanho_bytes, mime_type, status, rejeitado_motivo, criado_em
       FROM tomador_documentos WHERE user_id = $1 ORDER BY criado_em DESC`,
      [req.user.id]
    )
    res.json({ documentos: r.rows })
  } catch (e) {
    console.error('[DOCS] listar:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── POST /api/tomador/documentos ──────────────────────────────
export async function upload(req, res) {
  const { tipo } = req.body
  const file = req.file

  if (!file)
    return res.status(400).json({ error: 'Nenhum arquivo enviado' })

  if (!TIPOS_VALIDOS.includes(tipo))
    return res.status(400).json({ error: `Tipo inválido. Use: ${TIPOS_VALIDOS.join(', ')}` })

  try {
    const url = path.join(req.user.id, file.filename).replace(/\\/g, '/')

    const r = await pool.query(
      `INSERT INTO tomador_documentos (user_id, tipo, url, nome_arquivo, tamanho_bytes, mime_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendente') RETURNING *`,
      [req.user.id, tipo, url, file.originalname, file.size, file.mimetype]
    )
    res.status(201).json({ documento: r.rows[0] })
  } catch (e) {
    console.error('[DOCS] upload:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── DELETE /api/tomador/documentos/:id ────────────────────────
export async function remover(req, res) {
  try {
    const r = await pool.query(
      `DELETE FROM tomador_documentos WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    )
    if (!r.rows.length)
      return res.status(404).json({ error: 'Documento não encontrado' })

    // Remove o arquivo do disco
    const doc = r.rows[0]
    const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads'
    const filePath = path.join(UPLOAD_DIR, doc.url)
    await unlink(filePath).catch(() => {}) // silencia se já não existir

    res.json({ ok: true })
  } catch (e) {
    console.error('[DOCS] remover:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}

// ── PATCH /api/admin/documentos/:id/status (admin aprova/rejeita) ──
export async function atualizarStatus(req, res) {
  const { status, rejeitado_motivo } = req.body
  const allowed = ['pendente', 'aprovado', 'rejeitado']

  if (!allowed.includes(status))
    return res.status(400).json({ error: `Status inválido. Use: ${allowed.join(', ')}` })

  if (status === 'rejeitado' && !rejeitado_motivo)
    return res.status(400).json({ error: 'Informe o motivo da rejeição' })

  try {
    const r = await pool.query(
      `UPDATE tomador_documentos SET status = $1, rejeitado_motivo = $2
       WHERE id = $3 RETURNING *`,
      [status, rejeitado_motivo || null, req.params.id]
    )
    if (!r.rows.length)
      return res.status(404).json({ error: 'Documento não encontrado' })

    res.json({ documento: r.rows[0] })
  } catch (e) {
    console.error('[DOCS] atualizarStatus:', e.message)
    res.status(500).json({ error: 'Erro interno' })
  }
}
