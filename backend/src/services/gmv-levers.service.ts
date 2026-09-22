import { clickhouse } from '../lib/clickhouse'
import {
  buildDetailClause,
  buildFilterClause,
  computeComparisonRange,
  TABLE_SUMMARY_ORDER,
  toIsoDate,
  TWO_WINDOW_CLAUSE,
} from '../lib/query-helpers'
import type { ComparisonBasis, DetailFilters, OverviewFilters } from '../types/overview'

/**
 * The inputs for "why did GMV move?", split by marketplace and by brand:
 *
 *   TikTok  GMV = Impressions × CTR × CO rate × AOV
 *   Shopee  GMV =               Clicks × CO rate × AOV   (Shopee's affiliate centre has no impressions)
 *
 * Only additive totals come back; every rate is recomputed from them in the browser (CLAUDE.md),
 * so a brand's CTR is its clicks over its impressions, never an average of product CTRs.
 *
 * GMV and orders are affiliate orders from the order grain. Impressions and clicks are the
 * affiliate-centre product attributes, which repeat on every row of a product-day (and, on
 * Shopee, per channel), so they are collapsed with MAX at that grain before being summed —
 * the same dedupe the PID pages use.
 */

export type LeverMarketplace = 'Tiktok' | 'Shopee'

export interface LeverWindow {
  gmv: number
  orders: number
  clicks: number
  /** null on Shopee: its affiliate centre reports no impressions. */
  impressions: number | null
}

export interface MarketplaceLevers {
  marketplace: LeverMarketplace
  current: LeverWindow
  previous: LeverWindow
}

export interface BrandLevers {
  brand: string
  marketplaces: MarketplaceLevers[]
}

export interface GmvLeversResult {
  current: { from: string; to: string }
  comparison: { from: string; to: string }
  /** The whole filtered selection, one lane per marketplace. */
  total: MarketplaceLevers[]
  brands: BrandLevers[]
  /**
   * Filters that were set but cannot apply: impressions and clicks are product-level numbers,
   * so a pillar or SKU-grain filter would cut GMV while leaving clicks whole.
   */
  ignoredFilters: Array<keyof DetailFilters>
  /**
   * Marketplace → last day with funnel data, where that is before the window's end. That lane
   * (both windows, same day offset) stops there, so no orders are counted without their clicks.
   */
  funnelThrough: Partial<Record<LeverMarketplace, string>>
}

/** Only these detail filters sit at the product (PID) grain the funnel numbers live at. */
const PID_GRAIN_FILTERS: Array<keyof DetailFilters> = ['pidCategory', 'pidSubCategory', 'pidFormat']
const MARKETPLACES: LeverMarketplace[] = ['Tiktok', 'Shopee']

const emptyWindow = (marketplace: LeverMarketplace): LeverWindow => ({
  gmv: 0,
  orders: 0,
  clicks: 0,
  impressions: marketplace === 'Tiktok' ? 0 : null,
})

export async function getGmvLevers(
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: OverviewFilters,
  detail: DetailFilters = {},
  prevRange?: { from?: string; to?: string },
): Promise<GmvLeversResult> {
  const comparison = computeComparisonRange(from, to, basis, prevRange)
  const params: Record<string, unknown> = {
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const pidDetail: DetailFilters = {}
  for (const key of PID_GRAIN_FILTERS) if (detail[key]?.length) pidDetail[key] = detail[key]
  const ignoredFilters = (Object.keys(detail) as Array<keyof DetailFilters>).filter(
    (k) => detail[k]?.length && !PID_GRAIN_FILTERS.includes(k),
  )
  const filterClause = buildFilterClause(filters, params) + buildDetailClause(pidDetail, params)

  const base = `REGION_CODE = 'id' AND ITEM_MARKETPLACE_FLAG = TRUE ${TWO_WINDOW_CLAUSE} ${filterClause}`

  // Daily rows, folded into windows here: the funnel attributes can stop a few days before the
  // orders do (Shopee's affiliate centre lags), and cutting both windows at the same day needs
  // the dates. ~15 brands x 2 marketplaces x two windows of days is a small payload.
  const [ordersResult, tiktokResult, shopeeResult] = await Promise.all([
    clickhouse.query({
      query: `
        SELECT
          ifNull(BRAND_NAME, 'Unknown') AS brand,
          MARKETPLACE_NAME AS marketplace,
          DATE AS dt,
          SUM(GMV) AS gmv,
          SUM(ATTRIBUTED_ORDERS) AS orders
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${base}
          AND IS_AFFILIATE = TRUE
          AND MARKETPLACE_NAME IN ('Tiktok', 'Shopee')
        GROUP BY brand, marketplace, dt
      `,
      query_params: params,
      format: 'JSONEachRow',
    }),
    clickhouse.query({
      query: `
        SELECT brand, dt, SUM(impressions) AS impressions, SUM(clicks) AS clicks
        FROM (
          SELECT
            ifNull(BRAND_NAME, 'Unknown') AS brand,
            PRODUCT_ID AS pid,
            DATE AS dt,
            MAX(TT_PRODUCT_IMPRESSIONS) AS impressions,
            MAX(TT_PRODUCT_CLICKS) AS clicks
          FROM ${TABLE_SUMMARY_ORDER}
          WHERE ${base}
            AND MARKETPLACE_NAME = 'Tiktok'
          GROUP BY brand, pid, dt
        )
        GROUP BY brand, dt
      `,
      query_params: params,
      format: 'JSONEachRow',
    }),
    clickhouse.query({
      query: `
        SELECT brand, dt, SUM(clicks) AS clicks
        FROM (
          SELECT
            ifNull(BRAND_NAME, 'Unknown') AS brand,
            PRODUCT_ID AS pid,
            DATE AS dt,
            ifNull(SP_CHANNEL_TYPE, '(none)') AS channel,
            MAX(SP_CONFIRMED_CLICKS) AS clicks
          FROM ${TABLE_SUMMARY_ORDER}
          WHERE ${base}
            AND MARKETPLACE_NAME = 'Shopee'
          GROUP BY brand, pid, dt, channel
        )
        GROUP BY brand, dt
      `,
      query_params: params,
      format: 'JSONEachRow',
    }),
  ])

  type OrdersRow = { brand: string; marketplace: string; dt: string; gmv: number; orders: number }
  type FunnelRow = { brand: string; dt: string; impressions?: number; clicks: number }
  const day = (v: unknown) => String(v).slice(0, 10)
  const orderRows = await ordersResult.json<OrdersRow>()
  const funnelRows: Record<LeverMarketplace, FunnelRow[]> = {
    Tiktok: await tiktokResult.json<FunnelRow>(),
    Shopee: await shopeeResult.json<FunnelRow>(),
  }

  // Per marketplace: the last current-window day that has funnel data at all. When it falls
  // before `to`, both windows stop at that day's offset so neither carries orders with no clicks.
  const funnelThrough: Partial<Record<LeverMarketplace, string>> = {}
  const cuts = {} as Record<LeverMarketplace, { current: string; previous: string }>
  for (const marketplace of MARKETPLACES) {
    const last = funnelRows[marketplace]
      .filter((r) => Number(r.clicks || 0) > 0 && day(r.dt) >= from && day(r.dt) <= to)
      .reduce((max, r) => (day(r.dt) > max ? day(r.dt) : max), '')
    const current = last && last < to ? last : to
    if (last && last < to) funnelThrough[marketplace] = last
    const offset = Math.round((Date.parse(`${current}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
    const prev = new Date(`${comparison.from}T00:00:00Z`)
    prev.setUTCDate(prev.getUTCDate() + offset)
    cuts[marketplace] = { current, previous: toIsoDate(prev) }
  }
  const windowOf = (marketplace: LeverMarketplace, dt: string): 'current' | 'previous' | null => {
    const d = day(dt)
    if (d >= from && d <= cuts[marketplace].current) return 'current'
    if (d >= comparison.from && d <= comparison.to && d <= cuts[marketplace].previous) return 'previous'
    return null
  }

  const byBrand = new Map<string, Map<LeverMarketplace, MarketplaceLevers>>()
  const lane = (brand: string, marketplace: LeverMarketplace): MarketplaceLevers => {
    const lanes = byBrand.get(brand) ?? new Map<LeverMarketplace, MarketplaceLevers>()
    byBrand.set(brand, lanes)
    let entry = lanes.get(marketplace)
    if (!entry) {
      entry = { marketplace, current: emptyWindow(marketplace), previous: emptyWindow(marketplace) }
      lanes.set(marketplace, entry)
    }
    return entry
  }

  for (const r of orderRows) {
    const marketplace = r.marketplace as LeverMarketplace
    if (!MARKETPLACES.includes(marketplace)) continue
    const w = windowOf(marketplace, r.dt)
    if (!w) continue
    const entry = lane(r.brand, marketplace)
    entry[w].gmv += Number(r.gmv || 0)
    entry[w].orders += Number(r.orders || 0)
  }
  for (const marketplace of MARKETPLACES) {
    for (const r of funnelRows[marketplace]) {
      // A brand with clicks but no affiliate order has nothing to decompose; skip it.
      if (!byBrand.get(r.brand)?.has(marketplace)) continue
      const w = windowOf(marketplace, r.dt)
      if (!w) continue
      const entry = lane(r.brand, marketplace)
      entry[w].clicks += Number(r.clicks || 0)
      if (marketplace === 'Tiktok') entry[w].impressions = (entry[w].impressions ?? 0) + Number(r.impressions || 0)
    }
  }

  const brands: BrandLevers[] = [...byBrand.entries()]
    .map(([brand, lanes]) => ({
      brand,
      marketplaces: MARKETPLACES.filter((m) => lanes.has(m)).map((m) => lanes.get(m)!),
    }))
    .filter((b) => b.marketplaces.some((m) => m.current.gmv > 0 || m.previous.gmv > 0))

  // The selection's lanes are plain sums of the brands' additive totals.
  const total: MarketplaceLevers[] = MARKETPLACES.map((marketplace) => {
    const sum: MarketplaceLevers = {
      marketplace,
      current: emptyWindow(marketplace),
      previous: emptyWindow(marketplace),
    }
    for (const b of brands) {
      const m = b.marketplaces.find((x) => x.marketplace === marketplace)
      if (!m) continue
      for (const w of ['current', 'previous'] as const) {
        sum[w].gmv += m[w].gmv
        sum[w].orders += m[w].orders
        sum[w].clicks += m[w].clicks
        if (sum[w].impressions !== null) sum[w].impressions! += m[w].impressions ?? 0
      }
    }
    return sum
  }).filter((m) => m.current.gmv > 0 || m.previous.gmv > 0)

  return { current: { from, to }, comparison, total, brands, ignoredFilters, funnelThrough }
}
