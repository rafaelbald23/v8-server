import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import pool from './config/db.js'
import { runMigrations } from './config/migrate.js'
import './config/passport.js'

import healthRouter          from './routes/health.js'
import authRouter            from './routes/auth.js'
import socialAuthRouter      from './routes/socialAuth.js'
import adminRouter           from './routes/admin.js'
import documentosAdminRouter from './routes/documentosAdmin.js'
import tomadorRouter         from './routes/tomador.js'
import contatosRouter        from './routes/contatos.js'
import lgpdRouter            from './routes/lgpd.js'
import pagamentoRouter       from './routes/pagamento.js'
import investidorRouter      from './routes/investidor.js'

const app  = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL
    : 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

// ── Rotas ─────────────────────────────────────────────────────
app.use('/api/health',           healthRouter)
app.use('/api/auth',             authRouter)
app.use('/api/auth',             socialAuthRouter)
app.use('/api/admin',            adminRouter)
app.use('/api/admin',            documentosAdminRouter)
app.use('/api/tomador',          tomadorRouter)
app.use('/api/tomador/contatos', contatosRouter)
app.use('/api/lgpd',             lgpdRouter)
app.use('/api/pagamento',        pagamentoRouter)
app.use('/api/investidor',       investidorRouter)

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` })
})

async function start() {
  try {
    await pool.query('SELECT 1')
    console.log('[DB] Conexão OK')
    await runMigrations()
  } catch (e) {
    console.error('[DB] Falha na inicialização:', e.message)
    process.exit(1)
  }
  app.listen(PORT, () => {
    console.log(`[SERVER] V8 Exclusive API rodando na porta ${PORT} (${process.env.NODE_ENV ?? 'development'})`)
  })
}

start()
