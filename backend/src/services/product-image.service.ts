import { clickhouse } from '../lib/clickhouse'
import type { ProductImage } from '../types/shopee-pid'

/**
 * Product photos, resolved per marketplace from the integration dimensions.
 *
 * Snowflake-only on purpose: these two tables live in INTEGRATION.MARKETPLACE and have no
 * ClickHouse counterpart, so every caller treats a missing image as normal rather than an error.
 *
 * Both tables are SCD2. `DWH_ACTIVE_FLAG` reads false even on rows that are plainly current, so
 * it is not trustworthy as a filter — the latest row per id by EFFECTIVE_TIMESTAMP is.
 */
const SHOPEE_TABLE = 'INTEGRATION.MARKETPLACE.DIM_SHOPEE_ITEM'
const TIKTOK_TABLE = 'INTEGRATION.MARKETPLACE.DIM_TIKTOKSHOP_PRODUCT'

/** Photos change far less often than anything else on the page. */
const TTL_MS = 6 * 60 * 60 * 1000

export type ImageMarketplace = 'shopee' | 'tiktok'

interface Entry {
  image: ProductImage | null
  fetchedAt: number
}

const cache = new Map<string, Entry>()

const cacheKey = (marketplace: ImageMarketplace, pid: string) => `${marketplace}:${pid}`

/**
 * Shopee stores a JSON array of full-size URLs. Appending `_tn.webp` asks the CDN for the
 * thumbnail: ~13 KB against ~167-683 KB for the original, which matters because a detail panel
 * can show a dozen of these at once. That suffix is a CDN convention rather than a documented
 * contract, so the original is handed over too and the UI falls back to it on error.
 */
function shopeeUrls(raw: unknown): ProductImage | null {
  const first = parseJson<unknown[]>(raw)?.[0]
  if (typeof first !== 'string' || !first) return null
  return { url: `${first}_tn.webp`, fallback: first }
}

/**
 * TikTok stores a JSON array of image objects that already carry resized variants, so unlike
 * Shopee there is nothing to append — `thumb_urls[0]` is a 300x300 JPEG at roughly 14 KB.
 */
function tiktokUrls(raw: unknown): ProductImage | null {
  const first = parseJson<Array<Record<string, unknown>>>(raw)?.[0]
  if (!first) return null
  const thumb = firstString(first.thumb_urls)
  const full = firstString(first.url_list) ?? thumb
  if (!thumb) return null
  return { url: thumb, fallback: full ?? thumb }
}

function firstString(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  const first = value.find((v) => typeof v === 'string' && v.length > 0)
  return typeof first === 'string' ? first : null
}

/**
 * The Snowflake driver already decodes VARIANT columns into JS values, so these arrive parsed —
 * but the same column reads back as a string through other paths, so both are accepted.
 */
function parseJson<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'string') return raw as T
  try {
    return JSON.parse(raw) as T
  } catch {
    // A malformed row should cost one missing photo, never the request around it.
    return null
  }
}

interface RawRow {
  pid: string
  /** Decoded JSON, or its string form — see parseJson. */
  imgs: unknown
}

async function fetchImages(marketplace: ImageMarketplace, pids: string[]): Promise<void> {
  const shopee = marketplace === 'shopee'
  const result = await clickhouse.query({
    query: `
      SELECT ${shopee ? 'ITEM_ID' : 'PRODUCT_ID'} AS pid,
             ${shopee ? 'ITEM_IMAGE_URL_LIST' : 'PRODUCT_IMAGE_LIST'} AS imgs
      FROM ${shopee ? SHOPEE_TABLE : TIKTOK_TABLE}
      WHERE ${shopee ? 'ITEM_ID' : 'PRODUCT_ID'} IN {pids:Array(String)}
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY ${shopee ? 'ITEM_ID' : 'PRODUCT_ID'} ORDER BY EFFECTIVE_TIMESTAMP DESC
      ) = 1
    `,
    query_params: { pids },
    format: 'JSONEachRow',
  })

  const rows = await result.json<RawRow>()
  const found = new Map<string, ProductImage>()
  for (const row of rows) {
    if (!row.imgs) continue
    const parsed = shopee ? shopeeUrls(row.imgs) : tiktokUrls(row.imgs)
    if (parsed) found.set(String(row.pid), parsed)
  }

  const now = Date.now()
  // Misses are cached too, so a product with no photo is not looked up on every render.
  for (const pid of pids) {
    cache.set(cacheKey(marketplace, pid), { image: found.get(pid) ?? null, fetchedAt: now })
  }
}

/**
 * Photo URL per PID. Never throws: if the lookup fails the caller gets nulls and the page renders
 * without photos, which is the same thing it does for a product that genuinely has none.
 */
export async function getProductImages(
  marketplace: ImageMarketplace,
  pids: string[],
): Promise<Map<string, ProductImage | null>> {
  const now = Date.now()
  const wanted = [...new Set(pids.filter(Boolean).map(String))]
  const missing = wanted.filter((pid) => {
    const hit = cache.get(cacheKey(marketplace, pid))
    return !hit || now - hit.fetchedAt > TTL_MS
  })

  if (missing.length > 0) {
    try {
      await fetchImages(marketplace, missing)
    } catch (error) {
      console.warn(`Gagal memuat foto produk (${marketplace}):`, (error as Error).message)
    }
  }

  const out = new Map<string, ProductImage | null>()
  for (const pid of wanted) out.set(pid, cache.get(cacheKey(marketplace, pid))?.image ?? null)
  return out
}
