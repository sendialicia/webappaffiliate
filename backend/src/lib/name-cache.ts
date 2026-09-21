import { clickhouse } from './clickhouse'

/**
 * Resolving "the latest name per product" is by far the most expensive part of the product
 * endpoints: reading PRODUCT_NAME across millions of rows costs ~4.8s, about 70% of that query,
 * to produce roughly a thousand short strings.
 *
 * It is that expensive because the table is `ENGINE = MergeTree ORDER BY tuple()` — no sorting
 * key and no partitioning over 41M rows — so no filter prunes anything and every query is a full
 * scan. Narrowing the date range from 17 days to 1 changed the cost by under 25%.
 *
 * Names barely move, so they do not belong in the hot path. This keeps one map per scope and
 * refreshes it in the background; a request never waits for a refresh once the map is warm.
 */
const TTL_MS = 30 * 60 * 1000

interface Entry {
  names: Map<string, string>
  /** Extra descriptive fields, kept alongside the name for the SKU page. */
  extra: Map<string, Record<string, string>>
  fetchedAt: number
  refreshing: boolean
}

const cache = new Map<string, Entry>()

/**
 * Loads a scope's map in the background so the first reader never pays for it. Failures are
 * swallowed: a cold cache only means the first request resolves it itself.
 */
export function prewarmNames(spec: NameSpec): void {
  void getNames(spec).catch(() => undefined)
}

export interface NameSpec {
  /** Cache identity — include every clause that changes which rows are read. */
  key: string
  /** The id column, e.g. PRODUCT_ID or ifNull(BARCODE, '(none)'). */
  idColumn: string
  /** Scope clause without a date filter; the cache spans a wide window on purpose. */
  scope: string
  /** Column to resolve as the display name. */
  nameColumn: string
  /** Optional extra descriptive columns, resolved the same way. */
  extraColumns?: Record<string, string>
  /**
   * How far back to look. Kept modest on purpose: at 180 days this query read 7.6GB — the whole
   * table — and saturated the server enough to slow every other query running beside it. 60 days
   * covers MTD/QTD windows and their comparison periods while reading a fraction of that.
   */
  lookbackDays?: number
}

/**
 * Latest wins, so a product renamed mid-period resolves to one label. DATE breaks ties because
 * ETL_BATCH_TIME only has day precision in this table.
 */
function latest(column: string, alias: string): string {
  return `argMaxIf(${column}, (ETL_BATCH_TIME, DATE), ${column} IS NOT NULL) AS ${alias}`
}

async function load(spec: NameSpec): Promise<Entry> {
  const lookback = spec.lookbackDays ?? 60
  const extras = Object.entries(spec.extraColumns ?? {})

  const result = await clickhouse.query({
    query: `
      SELECT
        ${spec.idColumn} AS id,
        ${latest(spec.nameColumn, 'name')}
        ${extras.length ? ',' + extras.map(([alias, col]) => latest(col, alias)).join(',') : ''}
      FROM migration__marketplace.datamart_affiliate_summary_order
      WHERE ${spec.scope}
        AND DATE >= today() - ${lookback}
      GROUP BY id
    `,
    format: 'JSONEachRow',
  })

  const rows = await result.json<Record<string, string | null>>()
  const names = new Map<string, string>()
  const extra = new Map<string, Record<string, string>>()
  for (const r of rows) {
    const id = String(r.id ?? '')
    if (!id) continue
    if (r.name) names.set(id, r.name)
    if (extras.length) {
      const bag: Record<string, string> = {}
      for (const [alias] of extras) if (r[alias]) bag[alias] = r[alias] as string
      extra.set(id, bag)
    }
  }
  return { names, extra, fetchedAt: Date.now(), refreshing: false }
}

/**
 * Returns the cached map, loading it on the first call for a scope. Once warm, a stale map is
 * returned immediately and refreshed in the background so no request pays the scan.
 */
export async function getNames(spec: NameSpec): Promise<Entry> {
  const hit = cache.get(spec.key)

  if (!hit) {
    const entry = await load(spec)
    cache.set(spec.key, entry)
    return entry
  }

  if (Date.now() - hit.fetchedAt > TTL_MS && !hit.refreshing) {
    hit.refreshing = true
    void load(spec)
      .then((fresh) => cache.set(spec.key, fresh))
      .catch(() => {
        // Keep serving the stale map; a failed refresh must not break the page.
        hit.refreshing = false
      })
  }

  return hit
}
