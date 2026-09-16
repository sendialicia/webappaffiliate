import { clickhouse } from '../lib/clickhouse'
import {
  DETAIL_FILTER_COLUMNS,
  TABLE_CONTENT_PERFORMANCE,
  DETAIL_FILTER_LABELS,
  TABLE_DAILY_PERFORMANCE,
  TABLE_SUMMARY_ORDER,
  TWO_WINDOW_CLAUSE,
  bucketKey,
  buildDetailClause,
  buildFilterClause,
  computeComparisonRange,
  pctDelta,
  toIsoDate,
} from '../lib/query-helpers'
import type {
  ComparisonBasis,
  DetailFilters,
  FilterOption,
  FilterOptionsResult,
  CompositionDimension,
  CompositionResult,
  CompositionRow,
  CompositionTrendPoint,
  AcquisitionPoint,
  DailyPerformancePoint,
  DriverChartRow,
  EntityGrowthRow,
  DriverField,
  DriverEntity,
  DriversResult,
  FunnelContent,
  FunnelMarketplace,
  FunnelPillar,
  FunnelRate,
  FunnelResult,
  FunnelStage,
  KpiValue,
  MonthlyPerformancePoint,
  MonthlyPerformanceResult,
  OverviewFilters,
  PaceSummary,
  ProgressResult,
  ProgressRow,
  SpendResult,
  SpendRow,
  SummaryKpis,
  SummaryResult,
  SummaryTrendPoint,
  TrendGranularity,
} from '../types/overview'

function monthBounds(month: string): { start: string; end: string } {
  const parts = month.split('-').map(Number)
  const year = parts[0] ?? new Date().getFullYear()
  const mon = parts[1] ?? new Date().getMonth() + 1
  const start = `${year}-${String(mon).padStart(2, '0')}-01`
  const end = toIsoDate(new Date(Date.UTC(year, mon, 0)))
  return { start, end }
}

export async function getMonthlyPerformance(
  year: number,
  filters: OverviewFilters,
): Promise<MonthlyPerformanceResult> {
  const params: Record<string, unknown> = { year }
  const filterClause = buildFilterClause(filters, params)

  const result = await clickhouse.query({
    query: `
      WITH deduped AS (
        SELECT PERIOD_DATE, PERIOD_MONTH, BRAND_NAME, MARKETPLACE_NAME, METRIC_NAME, METRIC_VALUE, DAILY_POOL_TARGET
        FROM ${TABLE_DAILY_PERFORMANCE}
        WHERE REGION_CODE = 'id'
          AND METRIC_NAME IN ('Actual GMV', 'LY GMV')
          AND PERIOD_YEAR = {year:Int32}
          ${filterClause}
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY PERIOD_DATE, BRAND_NAME, MARKETPLACE_NAME, METRIC_NAME
          ORDER BY ETL_BATCH_TIME DESC
        ) = 1
      )
      SELECT
        PERIOD_MONTH AS month,
        SUM(CASE WHEN METRIC_NAME = 'Actual GMV' THEN METRIC_VALUE ELSE 0 END) AS actualGmv,
        SUM(CASE WHEN METRIC_NAME = 'LY GMV' THEN METRIC_VALUE ELSE 0 END) AS lyGmv,
        SUM(CASE WHEN METRIC_NAME = 'Actual GMV' THEN DAILY_POOL_TARGET ELSE 0 END) AS target
      FROM deduped
      GROUP BY PERIOD_MONTH
      ORDER BY PERIOD_MONTH ASC
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const months = await result.json<MonthlyPerformancePoint>()
  return { months, pace: computePace(months) }
}

function computePace(months: MonthlyPerformancePoint[]): PaceSummary {
  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const row = months.find((m) => m.month.startsWith(monthKey))

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = now.getDate()
  const daysLeft = daysInMonth - daysElapsed

  const actual = row?.actualGmv ?? 0
  const target = row?.target ?? 0
  const expected = target * (daysElapsed / daysInMonth)
  const projection = daysElapsed > 0 ? actual / (daysElapsed / daysInMonth) : 0

  return {
    monthLabel: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    actual,
    target,
    expected,
    remaining: target - actual,
    daysElapsed,
    daysInMonth,
    daysLeft,
    projection,
    actualPct: target > 0 ? actual / target : 0,
    expectedPct: daysElapsed / daysInMonth,
  }
}

export async function getDailyPerformance(
  month: string,
  filters: OverviewFilters,
): Promise<DailyPerformancePoint[]> {
  const { start, end } = monthBounds(month)
  const params: Record<string, unknown> = { start, end }
  const filterClause = buildFilterClause(filters, params)

  const result = await clickhouse.query({
    query: `
      WITH deduped AS (
        SELECT PERIOD_DATE, BRAND_NAME, MARKETPLACE_NAME, METRIC_NAME, METRIC_VALUE, DAILY_POOL_TARGET
        FROM ${TABLE_DAILY_PERFORMANCE}
        WHERE REGION_CODE = 'id'
          AND METRIC_NAME IN ('Actual GMV', 'LY GMV')
          AND PERIOD_DATE >= {start:Date} AND PERIOD_DATE <= {end:Date}
          ${filterClause}
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY PERIOD_DATE, BRAND_NAME, MARKETPLACE_NAME, METRIC_NAME
          ORDER BY ETL_BATCH_TIME DESC
        ) = 1
      )
      SELECT
        PERIOD_DATE AS date,
        SUM(CASE WHEN METRIC_NAME = 'Actual GMV' THEN METRIC_VALUE ELSE 0 END) AS actualGmv,
        SUM(CASE WHEN METRIC_NAME = 'LY GMV' THEN METRIC_VALUE ELSE 0 END) AS lyGmv,
        SUM(CASE WHEN METRIC_NAME = 'Actual GMV' THEN DAILY_POOL_TARGET ELSE 0 END) AS target
      FROM deduped
      GROUP BY PERIOD_DATE
      ORDER BY PERIOD_DATE ASC
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  return result.json<DailyPerformancePoint>()
}

export async function getProgress(month: string, filters: OverviewFilters): Promise<ProgressResult> {
  const { start } = monthBounds(month)

  const marketplaceParams: Record<string, unknown> = { month: start }
  const marketplaceFilter = buildFilterClause(
    filters.brand ? { brand: filters.brand } : {},
    marketplaceParams,
  )

  const brandParams: Record<string, unknown> = { month: start }
  const brandFilter = buildFilterClause(
    filters.marketplace ? { marketplace: filters.marketplace } : {},
    brandParams,
  )

  const [marketplace, brand] = await Promise.all([
    queryProgress('MARKETPLACE_NAME', marketplaceFilter, marketplaceParams),
    queryProgress('BRAND_NAME', brandFilter, brandParams),
  ])

  return { marketplace, brand }
}

async function queryProgress(
  groupColumn: 'MARKETPLACE_NAME' | 'BRAND_NAME',
  filterClause: string,
  params: Record<string, unknown>,
): Promise<ProgressRow[]> {
  const result = await clickhouse.query({
    query: `
      WITH deduped AS (
        SELECT PERIOD_DATE, BRAND_NAME, MARKETPLACE_NAME, METRIC_VALUE, DAILY_POOL_TARGET
        FROM ${TABLE_DAILY_PERFORMANCE}
        WHERE REGION_CODE = 'id'
          AND METRIC_NAME = 'Actual GMV'
          AND PERIOD_MONTH = {month:Date}
          ${filterClause}
        QUALIFY ROW_NUMBER() OVER (
          PARTITION BY PERIOD_DATE, BRAND_NAME, MARKETPLACE_NAME, METRIC_NAME
          ORDER BY ETL_BATCH_TIME DESC
        ) = 1
      )
      SELECT ${groupColumn} AS name, SUM(METRIC_VALUE) AS actual, SUM(DAILY_POOL_TARGET) AS target
      FROM deduped
      GROUP BY ${groupColumn}
      ORDER BY actual DESC
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const rows = await result.json<{ name: string; actual: number; target: number }>()
  return rows.map((r) => ({ ...r, pct: r.target > 0 ? r.actual / r.target : 0 }))
}

interface SummaryRow {
  date: string
  affGmv: number
  totalGmv: number
  affItems: number
  affOrders: number
  affCommission: number
  affRefund: number
  affCreators: number
}

export async function getSummary(
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: OverviewFilters,
  granularity: TrendGranularity,
  detail: DetailFilters = {},
  prevRange?: { from?: string; to?: string },
): Promise<SummaryResult> {
  const comparison = computeComparisonRange(from, to, basis, prevRange)
  const params: Record<string, unknown> = {
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const filterClause = buildFilterClause(filters, params) + buildDetailClause(detail, params)

  const result = await clickhouse.query({
    query: `
      SELECT
        DATE AS date,
        SUM(CASE WHEN IS_AFFILIATE THEN GMV ELSE 0 END) AS affGmv,
        SUM(GMV) AS totalGmv,
        SUM(CASE WHEN IS_AFFILIATE THEN ITEMS_SOLD ELSE 0 END) AS affItems,
        SUM(CASE WHEN IS_AFFILIATE THEN ATTRIBUTED_ORDERS ELSE 0 END) AS affOrders,
        SUM(CASE WHEN IS_AFFILIATE THEN COMMISSION ELSE 0 END) AS affCommission,
        SUM(CASE WHEN IS_AFFILIATE THEN REFUND_AMOUNT ELSE 0 END) AS affRefund,
        COUNT(DISTINCT CASE WHEN IS_AFFILIATE THEN AFFILIATE_USERNAME END) AS affCreators
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE REGION_CODE = 'id'
        AND ITEM_MARKETPLACE_FLAG = TRUE
        ${TWO_WINDOW_CLAUSE}
        ${filterClause}
      GROUP BY DATE
      ORDER BY DATE ASC
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const rows = await result.json<SummaryRow>()
  const currentRows = rows.filter((r) => r.date >= from && r.date <= to)
  const comparisonRows = rows.filter((r) => r.date >= comparison.from && r.date <= comparison.to)

  const [currentCreators, comparisonCreators] = await Promise.all([
    countDistinctCreators(from, to, filters, detail),
    countDistinctCreators(comparison.from, comparison.to, filters, detail),
  ])

  const currentAgg = aggregateRows(currentRows, currentCreators)
  const comparisonAgg = aggregateRows(comparisonRows, comparisonCreators)

  const kpis: SummaryKpis = {
    gmv: buildKpi(currentAgg.gmv, comparisonAgg.gmv),
    creators: buildKpi(currentAgg.creators, comparisonAgg.creators),
    gmvPerCreator: buildKpi(currentAgg.gmvPerCreator, comparisonAgg.gmvPerCreator),
    asp: buildKpi(currentAgg.asp, comparisonAgg.asp),
    aov: buildKpi(currentAgg.aov, comparisonAgg.aov),
    commission: buildKpi(currentAgg.commission, comparisonAgg.commission),
    affiliateShare: buildKpi(currentAgg.affiliateShare, comparisonAgg.affiliateShare),
    commissionRate: buildKpi(currentAgg.commissionRate, comparisonAgg.commissionRate),
    roi: buildKpi(currentAgg.roi, comparisonAgg.roi),
    refundRate: buildKpi(currentAgg.refundRate, comparisonAgg.refundRate),
    itemsSold: buildKpi(currentAgg.itemsSold, comparisonAgg.itemsSold),
  }

  return {
    current: { from, to },
    comparison: { ...comparison, basis },
    kpis,
    trend: bucketTrend(currentRows, granularity),
  }
}

function sumBy(rows: SummaryRow[], key: keyof SummaryRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0)
}

function aggregateRows(rows: SummaryRow[], creators: number) {
  const gmv = sumBy(rows, 'affGmv')
  const totalGmv = sumBy(rows, 'totalGmv')
  const items = sumBy(rows, 'affItems')
  const orders = sumBy(rows, 'affOrders')
  const commission = sumBy(rows, 'affCommission')
  const refund = sumBy(rows, 'affRefund')

  return {
    gmv,
    creators,
    gmvPerCreator: creators > 0 ? gmv / creators : 0,
    asp: items > 0 ? gmv / items : 0,
    aov: orders > 0 ? gmv / orders : 0,
    commission,
    affiliateShare: totalGmv > 0 ? gmv / totalGmv : 0,
    commissionRate: gmv > 0 ? commission / gmv : 0,
    roi: commission > 0 ? gmv / commission : 0,
    refundRate: gmv > 0 ? refund / gmv : 0,
    itemsSold: items,
  }
}

function buildKpi(current: number, previous: number): KpiValue {
  const delta = current - previous
  return { value: current, delta, deltaPct: previous !== 0 ? delta / previous : null }
}

async function countDistinctCreators(
  from: string,
  to: string,
  filters: OverviewFilters,
  detail: DetailFilters = {},
): Promise<number> {
  const params: Record<string, unknown> = { from, to }
  const filterClause = buildFilterClause(filters, params) + buildDetailClause(detail, params)

  const result = await clickhouse.query({
    query: `
      SELECT COUNT(DISTINCT AFFILIATE_USERNAME) AS creators
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE REGION_CODE = 'id'
        AND ITEM_MARKETPLACE_FLAG = TRUE
        AND IS_AFFILIATE = TRUE
        AND DATE >= {from:Date} AND DATE <= {to:Date}
        ${filterClause}
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const rows = await result.json<{ creators: number }>()
  return rows[0]?.creators ?? 0
}

function bucketTrend(rows: SummaryRow[], granularity: TrendGranularity): SummaryTrendPoint[] {
  const buckets = new Map<string, SummaryRow[]>()

  for (const row of rows) {
    const key = bucketKey(row.date, granularity)
    const list = buckets.get(key) ?? []
    list.push(row)
    buckets.set(key, list)
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([bucket, bucketRows]) => {
      const gmv = sumBy(bucketRows, 'affGmv')
      const totalGmv = sumBy(bucketRows, 'totalGmv')
      const items = sumBy(bucketRows, 'affItems')
      const orders = sumBy(bucketRows, 'affOrders')
      const commission = sumBy(bucketRows, 'affCommission')
      const refund = sumBy(bucketRows, 'affRefund')
      // Approximation: per-bucket creators is the average of daily distinct-creator
      // counts, not a true distinct count across the bucket (that would need one
      // extra query per bucket). Fine for a sparkline trend, not for KPI totals.
      const creators = Math.round(sumBy(bucketRows, 'affCreators') / bucketRows.length)

      return {
        bucket,
        gmv,
        creators,
        gmvPerCreator: creators > 0 ? gmv / creators : 0,
        asp: items > 0 ? gmv / items : 0,
        aov: orders > 0 ? gmv / orders : 0,
        commission,
        affiliateShare: totalGmv > 0 ? gmv / totalGmv : 0,
        commissionRate: gmv > 0 ? commission / gmv : 0,
        // null (not 0) so the chart shows a gap instead of a misleading value on
        // buckets where commission hasn't landed yet.
        roi: commission > 0 ? gmv / commission : null,
        refundRate: gmv > 0 ? refund / gmv : 0,
        itemsSold: items,
      }
    })
}

// PID_* columns are the marketplace-listing (product_id) grain, which matches the
// ITEM_MARKETPLACE_FLAG = TRUE scope these queries use. PRODUCT_* would be SKU grain.
const DIMENSION_COLUMNS: Record<CompositionDimension, string> = {
  pillar: 'PILLAR',
  category: 'PID_CATEGORY',
  format: 'PID_FORMAT',
}

export async function getComposition(
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: OverviewFilters,
  granularity: TrendGranularity,
  dimension: CompositionDimension,
  limit: number,
  detail: DetailFilters = {},
  prevRange?: { from?: string; to?: string },
): Promise<CompositionResult> {
  const column = DIMENSION_COLUMNS[dimension]
  const comparison = computeComparisonRange(from, to, basis, prevRange)
  const seriesParams: Record<string, unknown> = {
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const seriesFilter = buildFilterClause(filters, seriesParams) + buildDetailClause(detail, seriesParams)

  const seriesResult = await clickhouse.query({
    query: `
      SELECT
        ifNull(${column}, 'Unknown') AS name,
        DATE AS date,
        SUM(GMV) AS gmv
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE REGION_CODE = 'id'
        AND ITEM_MARKETPLACE_FLAG = TRUE
        AND IS_AFFILIATE = TRUE
        ${TWO_WINDOW_CLAUSE}
        ${seriesFilter}
      GROUP BY name, DATE
      ORDER BY DATE ASC
    `,
    query_params: seriesParams,
    format: 'JSONEachRow',
  })
  const seriesRows = await seriesResult.json<{ name: string; date: string; gmv: number }>()

  const creatorParams: Record<string, unknown> = {
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const creatorFilter = buildFilterClause(filters, creatorParams) + buildDetailClause(detail, creatorParams)

  // uniqExactIf lets both windows' distinct creator counts come back in one pass;
  // distinct counts can't be summed from per-day numbers.
  const creatorResult = await clickhouse.query({
    query: `
      SELECT
        ifNull(${column}, 'Unknown') AS name,
        uniqExactIf(AFFILIATE_USERNAME, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS creators,
        uniqExactIf(AFFILIATE_USERNAME, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS creatorsPrev
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE REGION_CODE = 'id'
        AND ITEM_MARKETPLACE_FLAG = TRUE
        AND IS_AFFILIATE = TRUE
        ${TWO_WINDOW_CLAUSE}
        ${creatorFilter}
      GROUP BY name
    `,
    query_params: creatorParams,
    format: 'JSONEachRow',
  })
  const creatorRows = await creatorResult.json<{ name: string; creators: number; creatorsPrev: number }>()
  const creatorByName = new Map(creatorRows.map((r) => [r.name, r]))

  const currentByName = new Map<string, number>()
  const previousByName = new Map<string, number>()
  for (const row of seriesRows) {
    const target =
      row.date >= from && row.date <= to
        ? currentByName
        : row.date >= comparison.from && row.date <= comparison.to
          ? previousByName
          : null
    if (target) target.set(row.name, (target.get(row.name) ?? 0) + Number(row.gmv || 0))
  }

  const totalCurrent = [...currentByName.values()].reduce((a, b) => a + b, 0)
  const totalPrevious = [...previousByName.values()].reduce((a, b) => a + b, 0)

  const names = new Set([...currentByName.keys(), ...previousByName.keys()])
  const allRows: CompositionRow[] = [...names].map((name) => {
    const gmv = currentByName.get(name) ?? 0
    const gmvPrev = previousByName.get(name) ?? 0
    const creators = Number(creatorByName.get(name)?.creators ?? 0)
    const creatorsPrev = Number(creatorByName.get(name)?.creatorsPrev ?? 0)

    return {
      name,
      gmv,
      gmvPrev,
      delta: gmv - gmvPrev,
      share: totalCurrent > 0 ? gmv / totalCurrent : 0,
      growth: gmvPrev > 0 ? (gmv - gmvPrev) / gmvPrev : null,
      creators,
      creatorsPrev,
      creatorsGrowth: creatorsPrev > 0 ? (creators - creatorsPrev) / creatorsPrev : null,
      gmvPerCreator: creators > 0 ? gmv / creators : 0,
      gmvPerCreatorPrev: creatorsPrev > 0 ? gmvPrev / creatorsPrev : 0,
    }
  })

  const rows = allRows.sort((a, b) => b.gmv - a.gmv).slice(0, limit)
  const keptNames = new Set(rows.map((r) => r.name))

  const buckets = new Map<string, CompositionTrendPoint>()
  for (const row of seriesRows) {
    if (row.date < from || row.date > to) continue
    if (!keptNames.has(row.name)) continue
    const key = bucketKey(row.date, granularity)
    const point = buckets.get(key) ?? ({ bucket: key } as CompositionTrendPoint)
    point[row.name] = (Number(point[row.name]) || 0) + Number(row.gmv || 0)
    buckets.set(key, point)
  }

  const trend = [...buckets.values()].sort((a, b) => (a.bucket < b.bucket ? -1 : 1))

  return {
    dimension,
    current: { from, to },
    comparison: { ...comparison, basis },
    totals: { current: totalCurrent, previous: totalPrevious, delta: totalCurrent - totalPrevious },
    rows,
    trend,
  }
}

const ENTITY_COLUMNS: Record<DriverEntity, string> = {
  brand: 'BRAND_NAME',
  marketplace: 'MARKETPLACE_NAME',
}

const DRIVER_FIELD_COLUMNS: Record<DriverField, string> = {
  brand: 'BRAND_NAME',
  marketplace: 'MARKETPLACE_NAME',
  pillar: 'PILLAR',
  pidCategory: 'PID_CATEGORY',
  pidSubCategory: 'PID_SUB_CATEGORY',
  pidFormat: 'PID_FORMAT',
}

export async function getDrivers(
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: OverviewFilters,
  entity: DriverField,
  dimension: DriverField,
  limit: number,
  detail: DetailFilters = {},
  prevRange?: { from?: string; to?: string },
): Promise<DriversResult> {
  const entityColumn = DRIVER_FIELD_COLUMNS[entity]
  const dimensionColumn = DRIVER_FIELD_COLUMNS[dimension]
  const comparison = computeComparisonRange(from, to, basis, prevRange)
  const params: Record<string, unknown> = {
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const filterClause = buildFilterClause(filters, params) + buildDetailClause(detail, params)

  const result = await clickhouse.query({
    query: `
      SELECT
        ifNull(${entityColumn}, 'Unknown') AS entity,
        ifNull(${dimensionColumn}, 'Unknown') AS name,
        sumIf(GMV, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS gmv,
        sumIf(GMV, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS gmvPrev
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE REGION_CODE = 'id'
        AND ITEM_MARKETPLACE_FLAG = TRUE
        AND IS_AFFILIATE = TRUE
        ${TWO_WINDOW_CLAUSE}
        ${filterClause}
      GROUP BY entity, name
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const rows = await result.json<{ entity: string; name: string; gmv: number; gmvPrev: number }>()

  const gmvByName = new Map<string, number>()
  for (const row of rows) {
    gmvByName.set(row.name, (gmvByName.get(row.name) ?? 0) + Number(row.gmv || 0))
  }
  const names = [...gmvByName.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name)
  const keptNames = new Set(names)

  const gmvByEntity = new Map<string, number>()
  for (const row of rows) {
    if (!keptNames.has(row.name)) continue
    gmvByEntity.set(row.entity, (gmvByEntity.get(row.entity) ?? 0) + Number(row.gmv || 0))
  }
  const entities = [...gmvByEntity.entries()].sort((a, b) => b[1] - a[1]).map(([e]) => e)

  const composition: DriverChartRow[] = []
  const growth: DriverChartRow[] = []
  const difference: DriverChartRow[] = []
  const entityGrowth: EntityGrowthRow[] = []

  for (const entityName of entities) {
    const compRow: DriverChartRow = { entity: entityName }
    const growRow: DriverChartRow = { entity: entityName }
    const diffRow: DriverChartRow = { entity: entityName }
    let entityGmv = 0
    let entityGmvPrev = 0

    for (const name of names) {
      const match = rows.find((r) => r.entity === entityName && r.name === name)
      entityGmv += Number(match?.gmv ?? 0)
      entityGmvPrev += Number(match?.gmvPrev ?? 0)
    }

    for (const name of names) {
      const match = rows.find((r) => r.entity === entityName && r.name === name)
      const gmv = Number(match?.gmv ?? 0)
      const gmvPrev = Number(match?.gmvPrev ?? 0)
      compRow[name] = gmv
      // Growth contribution in percentage points of the entity's previous total, so the
      // segments add up to the entity's overall growth and can be stacked diverging.
      // A per-name growth rate could not be stacked: percentages of different bases
      // do not sum to anything meaningful.
      growRow[name] = entityGmvPrev > 0 ? ((gmv - gmvPrev) / entityGmvPrev) * 100 : 0
      diffRow[name] = gmv - gmvPrev
    }

    composition.push(compRow)
    growth.push(growRow)
    difference.push(diffRow)
    entityGrowth.push({
      entity: entityName,
      growth: entityGmvPrev > 0 ? ((entityGmv - entityGmvPrev) / entityGmvPrev) * 100 : null,
    })
  }

  return { entity, dimension, names, composition, growth, difference, entityGrowth }
}

export async function getSpend(
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: OverviewFilters,
  granularity: TrendGranularity,
  entity: DriverEntity,
  detail: DetailFilters = {},
  prevRange?: { from?: string; to?: string },
): Promise<SpendResult> {
  const entityColumn = ENTITY_COLUMNS[entity]
  const comparison = computeComparisonRange(from, to, basis, prevRange)

  const tableParams: Record<string, unknown> = { from, to }
  const tableFilter = buildFilterClause(filters, tableParams) + buildDetailClause(detail, tableParams)

  const tableResult = await clickhouse.query({
    query: `
      SELECT
        ifNull(${entityColumn}, 'Unknown') AS name,
        SUM(GMV) AS gmv,
        SUM(COMMISSION) AS commission,
        uniqExact(AFFILIATE_USERNAME) AS creators
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE REGION_CODE = 'id'
        AND ITEM_MARKETPLACE_FLAG = TRUE
        AND IS_AFFILIATE = TRUE
        AND DATE >= {from:Date} AND DATE <= {to:Date}
        ${tableFilter}
      GROUP BY name
      ORDER BY gmv DESC
    `,
    query_params: tableParams,
    format: 'JSONEachRow',
  })

  const rawRows = await tableResult.json<{
    name: string
    gmv: number
    commission: number
    creators: number
  }>()

  const rows: SpendRow[] = rawRows.map((r) => {
    const gmv = Number(r.gmv || 0)
    const commission = Number(r.commission || 0)
    const creators = Number(r.creators || 0)
    return {
      name: r.name,
      gmv,
      commission,
      commissionRate: gmv > 0 ? commission / gmv : 0,
      roi: commission > 0 ? gmv / commission : 0,
      creators,
      gmvPerCreator: creators > 0 ? gmv / creators : 0,
    }
  })

  // "Creator acquisition" = creators active in this period that were NOT active in
  // the comparison period (definition confirmed with Sendi).
  const acqParams: Record<string, unknown> = {
    from,
    to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const acqFilter = buildFilterClause(filters, acqParams) + buildDetailClause(detail, acqParams)

  // Bucketing happens in SQL so each bucket gets a true distinct count; summing
  // per-day distinct counts would double-count creators active on several days.
  const bucketExpr =
    granularity === 'month'
      ? 'toStartOfMonth(DATE)'
      : granularity === 'week'
        ? 'toStartOfWeek(DATE, 1)'
        : 'DATE'

  const acqResult = await clickhouse.query({
    query: `
      SELECT
        ${bucketExpr} AS bucket,
        SUM(GMV) AS gmv,
        uniqExactIf(AFFILIATE_USERNAME, AFFILIATE_USERNAME NOT IN (
          SELECT DISTINCT AFFILIATE_USERNAME
          FROM ${TABLE_SUMMARY_ORDER}
          WHERE REGION_CODE = 'id'
            AND ITEM_MARKETPLACE_FLAG = TRUE
            AND IS_AFFILIATE = TRUE
            AND DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}
            ${acqFilter}
        )) AS newCreators
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE REGION_CODE = 'id'
        AND ITEM_MARKETPLACE_FLAG = TRUE
        AND IS_AFFILIATE = TRUE
        AND DATE >= {from:Date} AND DATE <= {to:Date}
        ${acqFilter}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
    query_params: acqParams,
    format: 'JSONEachRow',
  })

  const acqRows = await acqResult.json<{ bucket: string; gmv: number; newCreators: number }>()

  const acquisition: AcquisitionPoint[] = acqRows.map((row, i) => {
    const prevGmv = i > 0 ? Number(acqRows[i - 1]?.gmv ?? 0) : 0
    const gmv = Number(row.gmv || 0)
    return {
      bucket: row.bucket,
      gmv,
      newCreators: Number(row.newCreators || 0),
      growth: i > 0 && prevGmv > 0 ? (gmv - prevGmv) / prevGmv : null,
    }
  })

  return { entity, rows, acquisition }
}

export async function getFunnel(
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: OverviewFilters,
): Promise<FunnelResult> {
  const comparison = computeComparisonRange(from, to, basis)
  const params: Record<string, unknown> = {
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const filterClause = buildFilterClause(filters, params)

  // TT_*/SP_* are product-attribute columns that repeat across creator/pillar rows,
  // so per table-context they need MAX per product+date before any SUM.
  const stageResult = await clickhouse.query({
    query: `
      SELECT
        marketplace,
        sumIf(pImpressions, inCurrent) AS impressions,
        sumIf(pImpressions, inPrev) AS impressionsPrev,
        sumIf(pClicks, inCurrent) AS clicks,
        sumIf(pClicks, inPrev) AS clicksPrev,
        sumIf(pAtc, inCurrent) AS atc,
        sumIf(pAtc, inPrev) AS atcPrev,
        sumIf(pTtOrders, inCurrent) AS ttOrders,
        sumIf(pTtOrders, inPrev) AS ttOrdersPrev,
        sumIf(pSpClicks, inCurrent) AS spClicks,
        sumIf(pSpClicks, inPrev) AS spClicksPrev,
        sumIf(pSpOrders, inCurrent) AS spOrders,
        sumIf(pSpOrders, inPrev) AS spOrdersPrev,
        sumIf(pSpBuyers, inCurrent) AS spBuyers,
        sumIf(pSpBuyers, inPrev) AS spBuyersPrev
      FROM (
        SELECT
          ifNull(MARKETPLACE_NAME, 'Unknown') AS marketplace,
          DATE AS date,
          PRODUCT_ID AS pid,
          (DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS inCurrent,
          (DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS inPrev,
          MAX(TT_PRODUCT_IMPRESSIONS) AS pImpressions,
          MAX(TT_PRODUCT_CLICKS) AS pClicks,
          MAX(TT_ADD_TO_CART) AS pAtc,
          MAX(TT_AFF_TOTAL_ORDERS) AS pTtOrders,
          MAX(SP_PLACED_CLICKS) AS pSpClicks,
          MAX(SP_PLACED_ORDERS) AS pSpOrders,
          MAX(SP_PLACED_BUYERS) AS pSpBuyers
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE REGION_CODE = 'id'
          AND ITEM_MARKETPLACE_FLAG = TRUE
          ${TWO_WINDOW_CLAUSE}
          ${filterClause}
        GROUP BY marketplace, date, pid, inCurrent, inPrev
      )
      GROUP BY marketplace
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  type StageRow = Record<string, string | number | null>
  const stageRows = await stageResult.json<StageRow>()

  const pillarResult = await clickhouse.query({
    query: `
      SELECT
        ifNull(MARKETPLACE_NAME, 'Unknown') AS marketplace,
        ifNull(PILLAR, 'Unknown') AS pillar,
        sumIf(GMV, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS gmv,
        sumIf(GMV, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS gmvPrev,
        sumIf(ATTRIBUTED_ORDERS, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS orders,
        uniqExactIf(AFFILIATE_USERNAME, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS creators,
        uniqExactIf(AFFILIATE_USERNAME, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS creatorsPrev,
        uniqExactIf(AFFILIATE_USERNAME, GMV > 0 AND DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS profitCreators
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE REGION_CODE = 'id'
        AND ITEM_MARKETPLACE_FLAG = TRUE
        AND IS_AFFILIATE = TRUE
        ${TWO_WINDOW_CLAUSE}
        ${filterClause}
      GROUP BY marketplace, pillar
      ORDER BY gmv DESC
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const pillarRows = await pillarResult.json<{
    marketplace: string
    pillar: string
    gmv: number
    gmvPrev: number
    orders: number
    creators: number
    creatorsPrev: number
    profitCreators: number
  }>()

  // Content-side metrics. This table has no REGION_CODE and is not product-grained,
  // so it only takes the brand filter.
  const contentParams: Record<string, unknown> = {
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const contentFilter = filters.brand ? ' AND BRAND_NAME = {brand:String}' : ''
  if (filters.brand) contentParams.brand = filters.brand

  // Kept flat on purpose: wrapping this in a subquery stopped ClickHouse from
  // pruning by DATE and turned it into a full scan of ~15.7M rows.
  // Shopee rows exist here but stopped loading in Jul 2026, so this is TikTok only.
  const contentResult = await clickhouse.query({
    query: `
      SELECT
        ifNull(MARKETPLACE_NAME, 'Unknown') AS marketplace,
        uniqExactIf(AFFILIATE_USERNAME, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS creatorsPosting,
        uniqExactIf(AFFILIATE_USERNAME, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS creatorsPostingPrev,
        sumIf(TOTAL_NEW_CONTENT, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS totalNewContent,
        sumIf(TOTAL_NEW_CONTENT, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS totalNewContentPrev,
        sumIf(NEW_CONTENT_VIDEO, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS newContentVideo,
        sumIf(NEW_CONTENT_VIDEO, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS newContentVideoPrev,
        sumIf(NEW_CONTENT_LIVE, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS newContentLive,
        sumIf(NEW_CONTENT_LIVE, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS newContentLivePrev,
        uniqExactIf(AFFILIATE_USERNAME, NEW_CONTENT_VIDEO > 0 AND DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS creatorsVideo,
        uniqExactIf(AFFILIATE_USERNAME, NEW_CONTENT_VIDEO > 0 AND DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS creatorsVideoPrev,
        uniqExactIf(AFFILIATE_USERNAME, NEW_CONTENT_LIVE > 0 AND DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS creatorsLive,
        uniqExactIf(AFFILIATE_USERNAME, NEW_CONTENT_LIVE > 0 AND DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS creatorsLivePrev
      FROM ${TABLE_CONTENT_PERFORMANCE}
      WHERE MARKETPLACE_NAME = 'Tiktok'
        AND ((DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date})
          OR (DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}))
        ${contentFilter}
      GROUP BY marketplace
    `,
    query_params: contentParams,
    format: 'JSONEachRow',
  })

  const contentRows = await contentResult.json<Record<string, string | number | null>>()
  const contentByMarketplace = new Map(contentRows.map((r) => [String(r.marketplace), r]))

  const marketplaces: FunnelMarketplace[] = stageRows.map((row) => {
    const name = String(row.marketplace)
    const n = (key: string) => Number(row[key] ?? 0)

    const c = contentByMarketplace.get(name)
    const cn = (key: string) => Number(c?.[key] ?? 0)
    const isTiktok = name.toLowerCase() === 'tiktok'
    const stages: FunnelStage[] = isTiktok
      ? [
          { key: 'impressions', label: 'Impressions', value: n('impressions'), prev: n('impressionsPrev'), deltaPct: pctDelta(n('impressions'), n('impressionsPrev')) },
          { key: 'clicks', label: 'Clicks', value: n('clicks'), prev: n('clicksPrev'), deltaPct: pctDelta(n('clicks'), n('clicksPrev')) },
          { key: 'atc', label: 'Add to Cart', value: n('atc'), prev: n('atcPrev'), deltaPct: pctDelta(n('atc'), n('atcPrev')) },
          { key: 'orders', label: 'Orders', value: n('ttOrders'), prev: n('ttOrdersPrev'), deltaPct: pctDelta(n('ttOrders'), n('ttOrdersPrev')) },
        ]
      : [
          { key: 'clicks', label: 'Clicks', value: n('spClicks'), prev: n('spClicksPrev'), deltaPct: pctDelta(n('spClicks'), n('spClicksPrev')) },
          { key: 'orders', label: 'Orders', value: n('spOrders'), prev: n('spOrdersPrev'), deltaPct: pctDelta(n('spOrders'), n('spOrdersPrev')) },
          { key: 'buyers', label: 'Buyers', value: n('spBuyers'), prev: n('spBuyersPrev'), deltaPct: pctDelta(n('spBuyers'), n('spBuyersPrev')) },
        ]

    // Rate metrics are recomputed from the underlying totals, never averaged.
    const rate = (a: number, b: number) => (b > 0 ? a / b : null)
    const rates: FunnelRate[] = isTiktok
      ? [
          { key: 'ctr', label: 'CTR', value: rate(n('clicks'), n('impressions')), prev: rate(n('clicksPrev'), n('impressionsPrev')) },
          { key: 'atcRate', label: 'ATC Rate', value: rate(n('atc'), n('clicks')), prev: rate(n('atcPrev'), n('clicksPrev')) },
          { key: 'coRate', label: 'CO Rate', value: rate(n('ttOrders'), n('clicks')), prev: rate(n('ttOrdersPrev'), n('clicksPrev')) },
        ]
      : [
          { key: 'coRate', label: 'CO Rate', value: rate(n('spOrders'), n('spClicks')), prev: rate(n('spOrdersPrev'), n('spClicksPrev')) },
          { key: 'buyerRate', label: 'Buyer Rate', value: rate(n('spBuyers'), n('spClicks')), prev: rate(n('spBuyersPrev'), n('spClicksPrev')) },
        ]

    // Content figures only exist for the video and live pillars.
    const contentByPillar: Record<string, { creators: number; creatorsPrev: number; content: number; contentPrev: number }> = {
      Video: {
        creators: cn('creatorsVideo'),
        creatorsPrev: cn('creatorsVideoPrev'),
        content: cn('newContentVideo'),
        contentPrev: cn('newContentVideoPrev'),
      },
      Livestream: {
        creators: cn('creatorsLive'),
        creatorsPrev: cn('creatorsLivePrev'),
        content: cn('newContentLive'),
        contentPrev: cn('newContentLivePrev'),
      },
    }

    const pillars: FunnelPillar[] = pillarRows
      .filter((p) => p.marketplace === name)
      .map((p) => {
        const gmv = Number(p.gmv || 0)
        const creators = Number(p.creators || 0)
        const orders = Number(p.orders || 0)
        const pc = contentByPillar[p.pillar]
        return {
          name: p.pillar,
          ...(pc && (pc.content > 0 || pc.creators > 0)
            ? {
                contentCreators: pc.creators,
                contentCreatorsDeltaPct: pctDelta(pc.creators, pc.creatorsPrev),
                newContent: pc.content,
                newContentDeltaPct: pctDelta(pc.content, pc.contentPrev),
              }
            : {}),
          gmv,
          gmvDeltaPct: pctDelta(gmv, Number(p.gmvPrev || 0)),
          creators,
          creatorsDeltaPct: pctDelta(creators, Number(p.creatorsPrev || 0)),
          profitCreators: Number(p.profitCreators || 0),
          gmvPerCreator: creators > 0 ? gmv / creators : 0,
          aov: orders > 0 ? gmv / orders : 0,
        }
      })

    const content: FunnelContent = {
      available: Boolean(c) && (cn('totalNewContent') > 0 || cn('creatorsPosting') > 0),
      creatorsPosting: cn('creatorsPosting'),
      creatorsPostingDeltaPct: pctDelta(cn('creatorsPosting'), cn('creatorsPostingPrev')),
      totalNewContent: cn('totalNewContent'),
      totalNewContentDeltaPct: pctDelta(cn('totalNewContent'), cn('totalNewContentPrev')),
    }

    return { name, stages, rates, pillars, content }
  })

  return {
    marketplaces: marketplaces.sort((a, b) => a.name.localeCompare(b.name)),
    unavailable: [],
  }
}

/**
 * Distinct values for the detail-filter dropdowns. Scoped to the active brand /
 * marketplace / date range so the options stay relevant to what's on screen.
 */
export async function getFilterOptions(
  from: string,
  to: string,
  filters: OverviewFilters,
): Promise<FilterOptionsResult> {
  const params: Record<string, unknown> = { from, to }
  const filterClause = buildFilterClause(filters, params)

  const dimensionSelects = Object.entries(DETAIL_FILTER_COLUMNS)
    .map(([key, column]) => `groupUniqArray(500)(ifNull(${column}, 'Unknown')) AS ${key}`)
    .join(',\n        ')

  const result = await clickhouse.query({
    query: `
      SELECT
        groupUniqArray(200)(ifNull(BRAND_NAME, 'Unknown')) AS brands,
        groupUniqArray(50)(ifNull(MARKETPLACE_NAME, 'Unknown')) AS marketplaces,
        ${dimensionSelects}
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE REGION_CODE = 'id'
        AND ITEM_MARKETPLACE_FLAG = TRUE
        AND DATE >= {from:Date} AND DATE <= {to:Date}
        ${filterClause}
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const rows = await result.json<Record<string, string[]>>()
  const row = rows[0] ?? {}
  const sorted = (values: string[] | undefined) => [...(values ?? [])].sort((a, b) => a.localeCompare(b))

  const dimensions: FilterOption[] = (
    Object.keys(DETAIL_FILTER_COLUMNS) as Array<keyof typeof DETAIL_FILTER_COLUMNS>
  ).map((key) => ({
    key,
    label: DETAIL_FILTER_LABELS[key],
    values: sorted(row[key]),
  }))

  return {
    brands: sorted(row.brands),
    marketplaces: sorted(row.marketplaces),
    dimensions,
  }
}
