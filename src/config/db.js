import pg from 'pg'

const { Pool, types } = pg

// Retorna datas como string (evita conversão automática do driver)
types.setTypeParser(1082, (val) => val) // DATE
types.setTypeParser(1114, (val) => val) // TIMESTAMP
types.setTypeParser(1184, (val) => val) // TIMESTAMPTZ

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
})

pool.on('error', (err) => {
  console.error('[DB] Erro inesperado no pool:', err.message)
})

export default pool
