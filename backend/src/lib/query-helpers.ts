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
