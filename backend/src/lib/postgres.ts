import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import dotenv from 'dotenv'
import { Pool, types } from 'pg'

dotenv.config()

// A DATE has no time and no timezone, so turning it into a JS Date is wrong: node-postgres
// builds it at local midnight, and reading it back through toISOString() then shifts it a day
// earlier in UTC+7. Every annotation would have landed one day early. Keep it as the string
// Postgres actually sent.
const DATE_OID = 1082
types.setTypeParser(DATE_OID, (value) => value)

/**
 * Postgres holds the written layer — comments and annotations — while ClickHouse stays the
 * read-only analytics source. They never join; the page fetches from both and stitches in the UI.
 *
 * Local development runs the container in docker-compose.yml. The internal database is
 * provisioned separately, so nothing here assumes it can create the database itself.
 */
export const postgres = new Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgres://affiliate:affiliate@localhost:5433/affiliate_comments',
  // Writing a comment must never be the thing that hangs a page.
  connectionTimeoutMillis: 5_000,
  idle_in_transaction_session_timeout: 10_000,
  max: 8,
})

let ready: Promise<void> | null = null

/**
 * Applies any migration files the database has not seen yet, in filename order.
 *
 * Plain .sql files rather than an ORM's migration engine: these are the same statements IT will
 * run against the internal database, so there is nothing to translate or trust.
 */
export function migrate(): Promise<void> {
  ready ??= run()
  return ready
}

async function run(): Promise<void> {
  await postgres.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const dir = path.join(process.cwd(), 'migrations')
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  const applied = new Set(
    (await postgres.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name),
  )

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(path.join(dir, file), 'utf8')
    const client = await postgres.connect()
    try {
      // One transaction per file, so a half-applied migration can never be recorded as done.
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`Migrasi diterapkan: ${file}`)
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }
}

/** True when the database is reachable; the UI hides the comment panels when it is not. */
export async function postgresHealthy(): Promise<boolean> {
  try {
    await postgres.query('SELECT 1')
    return true
  } catch {
    return false
  }
}
