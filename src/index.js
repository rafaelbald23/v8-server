import 'dotenv/config'
import express from 'express'
import cors from 'cors'

import pool from './config/db.js'
import { runMigrations } from './config/migrate.js'
import './config/passport.js'
import authRouter from './routes/auth.js'
import socialAuthRouter from './routes/socialAuth.js'
import healthRouter from './routes/health.js'
import adminRouter from './routes/admin.js'
import tomadorRouter from './routes/tomador.js'
import documentosAdminRouter from './routes/documentosAdmin.js'

const app = express()
const PORT = process.env.PORT || 3000

// ── Middlewares ───────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL
    : 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

// ── Rotas ─────────────────────────────────────────────────────
app.use('/api/health', healthRouter)
app.use('/api/auth',   authRouter)
app.use('/api/auth',   socialAuthRouter)
app.use('/api/admin',   adminRouter)
app.use('/api/admin',   documentosAdminRouter)
app.use('/api/tomador', tomadorRouter)

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.path}` })
})

// ── Inicializa banco e sobe servidor ─────────────────────────
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
