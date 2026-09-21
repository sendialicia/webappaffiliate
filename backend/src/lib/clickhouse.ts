import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import snowflake from 'snowflake-sdk'
import { translate } from './sql-dialect'

dotenv.config()

/**
 * Snowflake branch. The services still import `clickhouse` and write ClickHouse SQL, on
 * purpose: this module keeps the client's shape — query({ query, query_params, format })
 * returning something with .json() — and translates the SQL on the way through (see
 * sql-dialect.ts). That keeps every service file identical to the ClickHouse branch, so a
 * fix made there carries over without a hand port.
 */

snowflake.configure({ logLevel: 'ERROR' })

/**
 * Key-pair auth. Locally the key sits in a file (SNOWFLAKE_PRIVATE_KEY_PATH, relative to the
 * backend folder); on Vercel there is no file to point at, so the key's full text goes in
 * SNOWFLAKE_PRIVATE_KEY instead. Hosts that store it on one line turn newlines into "\n".
 */
function privateKey(): string {
  const inline = process.env.SNOWFLAKE_PRIVATE_KEY
  if (inline) return inline.replace(/\\n/g, '\n')
  const keyPath = process.env.SNOWFLAKE_PRIVATE_KEY_PATH
  if (!keyPath) throw new Error('Set SNOWFLAKE_PRIVATE_KEY or SNOWFLAKE_PRIVATE_KEY_PATH in backend/.env')
  return fs.readFileSync(path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath), 'utf8')
}

const database = process.env.SNOWFLAKE_DATABASE || 'MIGRATION'
const schema = process.env.SNOWFLAKE_SCHEMA || 'MARKETPLACE'
const qualifiedSchema = `${database}.${schema}`

let pool: ReturnType<typeof snowflake.createPool> | null = null

/** Created on first use, so a missing key only fails the request that needs Snowflake. */
function getPool() {
  if (pool) return pool
  pool = snowflake.createPool(
    {
      account: process.env.SNOWFLAKE_ACCOUNT ?? '',
      username: process.env.SNOWFLAKE_USER ?? '',
      authenticator: 'SNOWFLAKE_JWT',
      privateKey: privateKey(),
      ...(process.env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE
        ? { privateKeyPass: process.env.SNOWFLAKE_PRIVATE_KEY_PASSPHRASE }
        : {}),
      ...(process.env.SNOWFLAKE_WAREHOUSE ? { warehouse: process.env.SNOWFLAKE_WAREHOUSE } : {}),
      ...(process.env.SNOWFLAKE_ROLE ? { role: process.env.SNOWFLAKE_ROLE } : {}),
      database,
      schema,
      clientSessionKeepAlive: true,
    },
    // A page fires up to ~10 queries at once; more connections than that only queue in Snowflake.
    { max: 8, min: 0, evictionRunIntervalMillis: 60_000, idleTimeoutMillis: 300_000 },
  )
  return pool
}

/** Result keys come back upper-cased; the code reads them in the case the SQL aliased them. */
function restoreKeys(row: Record<string, unknown>, aliases: Map<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) out[aliases.get(key) ?? key] = value
  return out
}

interface QueryArgs {
  query: string
  query_params?: Record<string, unknown>
  /** Kept for signature compatibility; results are always rows of objects. */
  format?: string
}

async function run(args: QueryArgs): Promise<Record<string, unknown>[]> {
  const { sql, binds, aliases } = translate(args.query, args.query_params ?? {}, qualifiedSchema)
  const rows = await getPool().use(
    (conn) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        conn.execute({
          sqlText: sql,
          binds,
          // Dates as 'YYYY-MM-DD' strings, like ClickHouse returned them: the services compare
          // and bucket dates as strings.
          fetchAsString: ['Date'],
          complete: (err, _stmt, result) => {
            if (err) {
              err.message = `${err.message}\n--- SQL ---\n${sql}`
              reject(err)
            } else resolve((result ?? []) as Record<string, unknown>[])
          },
        })
      }),
  )
  return rows.map((r) => restoreKeys(r, aliases))
}

export const clickhouse = {
  async query(args: QueryArgs) {
    const rows = await run(args)
    return {
      json: async <T = unknown>(): Promise<T[]> => rows as T[],
    }
  },
}
