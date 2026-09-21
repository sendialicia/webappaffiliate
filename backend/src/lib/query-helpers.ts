import type { ComparisonBasis, DetailFilters, OverviewFilters, TrendGranularity } from '../types/overview'

export const TABLE_DAILY_PERFORMANCE = 'migration__marketplace.datamart_affiliate_daily_performance'
export const TABLE_SUMMARY_ORDER = 'migration__marketplace.datamart_affiliate_summary_order'
export const TABLE_CONTENT_PERFORMANCE =
  'migration__marketplace.datamart_affiliate_content_performance'

export function buildFilterClause(filters: OverviewFilters, params: Record<string, unknown>): string {
  let clause = ''
  if (filters.brand?.length) {
    clause += ' AND BRAND_NAME IN {brands:Array(String)}'
    params.brands = filters.brand
  }
  if (filters.marketplace?.length) {
    clause += ' AND MARKETPLACE_NAME IN {marketplaces:Array(String)}'
    params.marketplaces = filters.marketplace
  }
  return clause
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Column behind each detail filter, all on datamart_affiliate_summary_order. */
export const DETAIL_FILTER_COLUMNS: Record<keyof DetailFilters, string> = {
  pillar: 'PILLAR',
  subpillar: 'SUBPILLAR',
  pidCategory: 'PID_CATEGORY',
  pidSubCategory: 'PID_SUB_CATEGORY',
  pidFormat: 'PID_FORMAT',
  productCategory: 'PRODUCT_CATEGORY',
  productSubCategory: 'PRODUCT_SUB_CATEGORY',
  productFormat: 'PRODUCT_FORMAT',
}

export const DETAIL_FILTER_LABELS: Record<keyof DetailFilters, string> = {
  pillar: 'Pillar',
  subpillar: 'Sub Pillar',
  pidCategory: 'PID Category',
  pidSubCategory: 'PID Sub Category',
  pidFormat: 'PID Format',
  productCategory: 'Product Category',
  productSubCategory: 'Product Sub Category',
  productFormat: 'Product Format',
}

export function buildDetailClause(
  detail: DetailFilters | undefined,
  params: Record<string, unknown>,
): string {
  if (!detail) return ''
  let clause = ''
  for (const [key, column] of Object.entries(DETAIL_FILTER_COLUMNS)) {
    const values = detail[key as keyof DetailFilters]
    if (!values?.length) continue
    params[key] = values
    clause += ` AND ifNull(${column}, 'Unknown') IN {${key}:Array(String)}`
  }
  return clause
}

export function computeComparisonRange(
  from: string,
  to: string,
  basis: ComparisonBasis,
  explicit?: { from?: string; to?: string },
): { from: string; to: string } {
  if (basis === 'custom' && explicit?.from && explicit?.to) {
    return { from: explicit.from, to: explicit.to }
  }

  if (basis === 'ly') {
    return { from: shiftYears(from, -1), to: shiftYears(to, -1) }
  }

  const fromDate = new Date(from)
  const rangeDays = Math.round((new Date(to).getTime() - fromDate.getTime()) / 86_400_000) + 1

  const prevTo = new Date(fromDate)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - (rangeDays - 1))

  return { from: toIsoDate(prevFrom), to: toIsoDate(prevTo) }
}

function shiftYears(date: string, years: number): string {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + years)
  return toIsoDate(d)
}

export function bucketKey(date: string, granularity: TrendGranularity): string {
  if (granularity === 'day') return date
  if (granularity === 'month') return date.slice(0, 7)

  const d = new Date(`${date}T00:00:00Z`)
  const diffToMonday = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - diffToMonday)
  return toIsoDate(d)
}

/** SQL expression that buckets DATE at the requested granularity. */
export function bucketExpression(granularity: TrendGranularity): string {
  if (granularity === 'month') return 'toStartOfMonth(DATE)'
  if (granularity === 'week') return 'toStartOfWeek(DATE, 1)'
  return 'DATE'
}

/**
 * Restricts a scan to just the current and comparison windows instead of the whole
 * span between them. With "vs LY" the two windows sit ~12 months apart, so scanning
 * the gap made these queries an order of magnitude slower for no reason.
 * Requires currentFrom/currentTo/prevFrom/prevTo in query_params.
 */
export const TWO_WINDOW_CLAUSE = `AND (
        (DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date})
        OR (DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date})
      )`

export function pctDelta(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null
}

export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null
}

/**
 * The metrics every GMV trend returns per bucket, so a chart can plot up to three of them.
 * All additive except creators (a true distinct count per bucket, not a sum of days) and AOV,
 * which is recomputed from the bucket's own totals in toTrendMetrics.
 */
export const TREND_METRICS_SQL = `
        SUM(GMV) AS gmv,
        SUM(ITEMS_SOLD) AS itemsSold,
        SUM(ATTRIBUTED_ORDERS) AS orders,
        SUM(COMMISSION) AS commission,
        uniqExact(AFFILIATE_USERNAME) AS creators`

export interface TrendMetrics {
  gmv: number
  itemsSold: number
  orders: number
  commission: number
  creators: number
  aov: number | null
}

export function toTrendMetrics(row: Record<string, unknown>): TrendMetrics {
  const gmv = Number(row.gmv || 0)
  const orders = Number(row.orders || 0)
  return {
    gmv,
    itemsSold: Number(row.itemsSold || 0),
    orders,
    commission: Number(row.commission || 0),
    creators: Number(row.creators || 0),
    aov: ratio(gmv, orders),
  }
}

/**
 * Order volume from the internal order data, for the current window. This is the headline
 * source for orders, items and commission everywhere; the SP_/TT_ marketplace-centre columns
 * count differently (Shopee's placed orders include cancelled ones, ~20% above) and are kept
 * only for what the order data does not carry — clicks, impressions, buyers, new content.
 * Needs `inCurrent` and the three columns selected in the inner query.
 */
export const ORDER_METRICS_SQL = `
        sumIf(ATTRIBUTED_ORDERS, inCurrent) AS orders,
        sumIf(ITEMS_SOLD, inCurrent) AS itemsSold,
        sumIf(COMMISSION, inCurrent) AS orderCommission`

export interface OrderMetrics {
  orders: number
  itemsSold: number
  commission: number
  aov: number | null
  roi: number | null
  commissionRate: number | null
}

export function toOrderMetrics(row: Record<string, unknown>, gmv: number): OrderMetrics {
  const orders = Number(row.orders || 0)
  const commission = Number(row.orderCommission || 0)
  return {
    orders,
    itemsSold: Number(row.itemsSold || 0),
    commission,
    // Rates recomputed from the row's own totals, never averaged (CLAUDE.md).
    aov: ratio(gmv, orders),
    roi: ratio(gmv, commission),
    commissionRate: ratio(commission, gmv),
  }
}

/** Order metrics for a total row, rebuilt from the child rows' additive parts. */
export function sumOrderMetrics(rows: OrderMetrics[], gmv: number): OrderMetrics {
  const add = (pick: (r: OrderMetrics) => number) => rows.reduce((acc, r) => acc + pick(r), 0)
  return toOrderMetrics(
    { orders: add((r) => r.orders), itemsSold: add((r) => r.itemsSold), orderCommission: add((r) => r.commission) },
    gmv,
  )
}
