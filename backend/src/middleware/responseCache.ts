import type { NextFunction, Request, Response } from 'express'
import { INTERNAL_SECRET_HEADER } from './internalAuth'

/**
 * Caches GET /api responses in memory.
 *
 * The dashboard is read-only and the ETL lands once a day, so serving a result a few minutes old
 * is harmless. What it buys is large: pulling a result set from ClickHouse runs over a VPN at
 * ~50 KB/s, and that transfer — not the query — is what makes these endpoints slow. A cache hit
 * skips it entirely.
 *
 * Stale entries are served immediately and refreshed in the background, so a reader never waits
 * on an expiry. Only the first request for a given view pays full price, and the default views
 * are warmed at boot.
 */
const TTL_MS = 10 * 60 * 1000
/** Entries run up to ~1.6MB of JSON, so the map is bounded and evicts the oldest first. */
const MAX_ENTRIES = 120
/** Set by the background refresh so it re-runs the handler instead of reading its own entry. */
const BYPASS_HEADER = 'x-cache-refresh'
/**
 * Written data, not analytics. Caching these for ten minutes would mean a comment you just
 * posted does not come back — the cache exists for expensive read-only queries, not for these.
 */
const NEVER_CACHE = ['/api/comments', '/api/annotations']

interface Entry {
  body: string
  storedAt: number
  refreshing: boolean
}

const cache = new Map<string, Entry>()

/** Sorted params, so a different call-site ordering still resolves to the same entry. */
function cacheKey(req: Request): string {
  const [path, rawQuery = ''] = req.originalUrl.split('?')
  const params = [...new URLSearchParams(rawQuery).entries()].sort(([a], [b]) => a.localeCompare(b))
  return `${path}?${params.map(([k, v]) => `${k}=${v}`).join('&')}`
}

function store(key: string, body: string): void {
  if (cache.size >= MAX_ENTRIES && !cache.has(key)) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { body, storedAt: Date.now(), refreshing: false })
}

const port = process.env.PORT || 4000

/** The refresh and warm-up calls go through the same auth check as everything else. */
function internalHeaders(): Record<string, string> {
  return { [INTERNAL_SECRET_HEADER]: process.env.INTERNAL_API_SECRET ?? '' }
}

/** Re-fetches through the server's own HTTP surface, which keeps one code path for everything. */
function refreshInBackground(url: string, key: string): void {
  const entry = cache.get(key)
  if (!entry || entry.refreshing) return
  entry.refreshing = true

  fetch(`http://127.0.0.1:${port}${url}`, { headers: { [BYPASS_HEADER]: '1', ...internalHeaders() } })
    .then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      store(key, await r.text())
    })
    .catch(() => {
      // Keep serving the stale body; a failed refresh must never surface to the reader.
      entry.refreshing = false
    })
}

export function responseCache(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' || !req.path.startsWith('/api/')) return next()
  if (NEVER_CACHE.some((prefix) => req.path.startsWith(prefix))) return next()

  const key = cacheKey(req)
  const isRefresh = req.headers[BYPASS_HEADER] === '1'
  const hit = isRefresh ? undefined : cache.get(key)

  if (hit) {
    if (Date.now() - hit.storedAt > TTL_MS) refreshInBackground(req.originalUrl, key)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('X-Cache', 'HIT')
    res.send(hit.body)
    return
  }

  // Intercept the handler's own json() so a miss populates the cache on its way out.
  const originalJson = res.json.bind(res)
  res.json = (payload: unknown) => {
    // Never cache an error: a transient ClickHouse timeout must not stick around for ten minutes.
    if (res.statusCode === 200) store(key, JSON.stringify(payload))
    res.setHeader('X-Cache', isRefresh ? 'REFRESH' : 'MISS')
    return originalJson(payload)
  }
  next()
}

/**
 * Warms an URL so the first real reader gets a hit. Runs through the same HTTP path as a browser,
 * which guarantees the warmed key is exactly the one a browser will ask for.
 */
export async function warmUrl(url: string): Promise<void> {
  try {
    await fetch(`http://127.0.0.1:${port}${url}`, { headers: internalHeaders() })
  } catch {
    // Warming is best-effort; a cold cache only means the first reader resolves it.
  }
}

export function cacheStats(): { entries: number } {
  return { entries: cache.size }
}
