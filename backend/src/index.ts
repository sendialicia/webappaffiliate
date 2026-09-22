import express from 'express'
import cors from 'cors'
import compression from 'compression'
import { healthRouter } from './routers/health.router'
import { overviewRouter } from './routers/overview.router'
import { shopeePidRouter } from './routers/shopee-pid.router'
import { tiktokPidRouter } from './routers/tiktok-pid.router'
import { skuRouter } from './routers/sku.router'
import { commentsRouter } from './routers/comments.router'
import { productImagesRouter } from './routers/product-images.router'
import { requestLogger } from './middleware/requestLogger'
import { internalAuth } from './middleware/internalAuth'
import { errorHandler } from './middleware/errorHandler'
import { responseCache, warmUrl } from './middleware/responseCache'
import { prewarmNames } from './lib/name-cache'
import { migrate } from './lib/postgres'

const app = express()
// Browsers reach this API only through the Next.js proxy route (server to server), so no origin
// needs CORS by default. CORS_ORIGIN opens it for a specific origin if that ever changes.
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false }))
// The product responses are 0.6-1.6MB of JSON. Over a network that is the dominant cost, and
// this kind of payload compresses roughly 10x.
app.use(compression())
app.use(express.json())
app.use(requestLogger)
// Before the cache on purpose: a cache hit is still data, and must not be served to a request
// that failed the check.
app.use(internalAuth)
app.use(responseCache)

app.use(healthRouter)
app.use(overviewRouter)
app.use(shopeePidRouter)
app.use(tiktokPidRouter)
app.use(skuRouter)
app.use(commentsRouter)
app.use(productImagesRouter)

app.use(errorHandler)

// On Vercel the app runs as a function: Vercel owns the listener, and there is no long-lived
// process for boot-time cache warming to pay off in. Locally it is a normal server.
export default app

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 4000
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`)
    warmNameCaches()
    warmDefaultViews()
    // Comments are a side feature: if Postgres is down the analytics pages must still work.
    migrate().catch((e) => console.warn('Postgres belum siap, fitur komentar nonaktif:', e.message))
  })
}

/**
 * Resolving the latest product name is a full table scan on this table, so it is cached. Warming
 * the caches at boot keeps that scan off the first reader's request. Staggered because the scans
 * are heavy enough to slow each other down if they run together.
 */
function warmNameCaches() {
  const specs = [
    { key: 'shopee-pid-product-name', idColumn: 'PRODUCT_ID', nameColumn: 'PRODUCT_NAME',
      scope: `REGION_CODE = 'id' AND ITEM_MARKETPLACE_FLAG = TRUE AND MARKETPLACE_NAME = 'Shopee'` },
    { key: 'tiktok-pid-product-name', idColumn: 'PRODUCT_ID', nameColumn: 'PRODUCT_NAME',
      scope: `REGION_CODE = 'id' AND ITEM_MARKETPLACE_FLAG = TRUE AND MARKETPLACE_NAME = 'Tiktok'` },
    { key: 'sku-name-split', idColumn: `ifNull(BARCODE, '(none)')`, nameColumn: 'VARIANT_SAP_NAME',
      scope: `REGION_CODE = 'id' AND BUNDLE_FLAG = FALSE AND GWP_FLAG = FALSE`,
      extraColumns: {
        variantName: 'VARIANT_NAME', productName: 'PRODUCT_NAME', category: 'PRODUCT_CATEGORY',
        subCategory: 'PRODUCT_SUB_CATEGORY', format: 'PRODUCT_FORMAT',
      } },
  ]
  specs.forEach((spec, i) => setTimeout(() => prewarmNames(spec), i * 20_000))
}

/** Local calendar date, matching how the frontend builds its default MTD range. */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Warms exactly what each page asks for on first load, so opening the dashboard is a cache hit
 * rather than a cold set of ClickHouse round trips. Runs after the name caches, and one view at a
 * time: these queries are heavy enough to slow each other down if they overlap.
 */
function warmDefaultViews() {
  const today = new Date()
  const from = isoDate(new Date(today.getFullYear(), today.getMonth(), 1))
  const to = isoDate(today)
  const base = `from=${from}&to=${to}&compare=prev`
  const scope = `${base}&level=category`

  const urls = [
    `/api/overview/filter-options?from=${from}&to=${to}`,
    `/api/overview/summary?${base}&granularity=day`,
    `/api/shopee-pid/categories?${scope}`,
    `/api/shopee-pid/products?${scope}`,
    `/api/shopee-pid/trend?${scope}&granularity=day`,
    `/api/shopee-pid/top-creators?${scope}&limit=20`,
    `/api/tiktok-pid/categories?${scope}`,
    `/api/tiktok-pid/products?${scope}`,
    `/api/tiktok-pid/trend?${scope}&granularity=day`,
    `/api/tiktok-pid/top-creators?${scope}&limit=20`,
    `/api/sku/filter-options?from=${from}&to=${to}`,
    `/api/sku/categories?${scope}`,
    `/api/sku/products?${scope}`,
    `/api/sku/trend?${scope}&granularity=day`,
    `/api/sku/top-creators?${scope}&limit=20`,
  ]

  // Starts after the name caches are settled, then strictly sequential.
  setTimeout(async () => {
    for (const url of urls) await warmUrl(url)
    console.log(`Cache respons dihangatkan: ${urls.length} tampilan default`)
  }, 70_000)
}
