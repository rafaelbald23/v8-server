import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import pool from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function runMigrations() {
  const migrations = [
    '001_initial_schema.sql',
    '002_full_schema.sql',
  ]

  for (const file of migrations) {
    const sql = readFileSync(join(__dirname, '../../db/migrations', file), 'utf8')
    await pool.query(sql)
    console.log(`[MIGRATE] ${file} OK`)
  }
}
