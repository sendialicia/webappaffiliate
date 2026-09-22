import { clickhouse } from '../lib/clickhouse'
import { getCreatorDetail } from './creator-detail.service'
import { findOpportunityCreators, similarityColumn, type SimilarityLevel } from './opportunity.service'
import { getNames } from '../lib/name-cache'
import { getVariantContribution } from '../lib/variants'
import {
  buildDetailClause,
  TABLE_SUMMARY_ORDER,
  TWO_WINDOW_CLAUSE,
  bucketExpression,
  buildFilterClause,
  computeComparisonRange,
  pctDelta,
  ratio,
  TREND_METRICS_SQL,
  toTrendMetrics,
  ORDER_METRICS_SQL,
  sumOrderMetrics,
  toOrderMetrics,
} from '../lib/query-helpers'
import type { ComparisonBasis, TrendGranularity } from '../types/overview'
import type { CreatorDetail } from '../types/creator-detail'
import type {
  OpportunityCreatorRow,
  OpportunityCreatorsResult,
  PidCategoriesResult,
  PidCategoryRow,
  PidCreatorRow,
  PidCreatorsResult,
  PidFilters,
  PidLevel,
  PidPillarContribution,
  PidProductDetail,
  PidProductRow,
  PidProductsResult,
  PidTrendPoint,
  ShopeeAttributes,
} from '../types/shopee-pid'

const LEVEL_COLUMNS: Record<PidLevel, string> = {
  category: 'PID_CATEGORY',
  subcategory: 'PID_SUB_CATEGORY',
  format: 'PID_FORMAT',
}

const SHOPEE_SCOPE = `REGION_CODE = 'id' AND ITEM_MARKETPLACE_FLAG = TRUE AND MARKETPLACE_NAME = 'Shopee'`

/**
 * SP_* columns are product attributes that repeat across every creator/pillar row,
 * so they must be collapsed with MAX before any SUM — a raw SUM over-counts ~30x.
 *
 * Their real grain is product + date + SP_CHANNEL_TYPE, not product + date as the
 * table-context states: Shopee splits these across up to 3 channels (Media sosial /
 * Video / Live, plus an unlabelled one). Collapsing on product+date alone kept the
 * largest channel and silently dropped the rest, losing 34% of SP GMV.
 */
const SP_CHANNEL = `ifNull(SP_CHANNEL_TYPE, '(none)') AS channel`
const SP_INNER_COLUMNS = `
  MAX(SP_CONFIRMED_GMV) AS spGmv,
  MAX(SP_CONFIRMED_ORDERS) AS spOrders,
  MAX(SP_CONFIRMED_CLICKS) AS spClicks,
  MAX(SP_CONFIRMED_BUYERS) AS spBuyers,
  MAX(SP_CONFIRMED_NEW_BUYERS) AS spNewBuyers,
  MAX(SP_CONFIRMED_PRODUCT_SOLD) AS spProductSold,
  MAX(SP_CONFIRMED_EST_COMMISSION) AS spCommission`

/**
 * Per-window sums over the deduped rows. A date belongs to exactly one window, so the flag can
 * ride along in the inner GROUP BY without splitting any group.
 */
const SP_WINDOW_COLUMNS = (flag: string, suffix: string) =>
  ['spGmv', 'spOrders', 'spClicks', 'spBuyers', 'spNewBuyers', 'spProductSold', 'spCommission']
    .map((c) => `sumIf(${c}, ${flag}) AS ${c}${suffix}`)
    .join(', ')

const SP_OUTER_COLUMNS = `
  SUM(spGmv) AS spGmv,
  SUM(spOrders) AS spOrders,
  SUM(spClicks) AS spClicks,
  SUM(spBuyers) AS spBuyers,
  SUM(spNewBuyers) AS spNewBuyers,
  SUM(spProductSold) AS spProductSold,
  SUM(spCommission) AS spCommission`

interface RawShopeeAttrs {
  spGmv?: number
  spOrders?: number
  spClicks?: number
  spBuyers?: number
  spNewBuyers?: number
  spProductSold?: number
  spCommission?: number
}

function toAttributes(raw: RawShopeeAttrs): ShopeeAttributes {
  const spGmv = Number(raw.spGmv ?? 0)
  const spOrders = Number(raw.spOrders ?? 0)
  const spClicks = Number(raw.spClicks ?? 0)
  const spCommission = Number(raw.spCommission ?? 0)

  return {
    spGmv,
    spOrders,
    spClicks,
    spBuyers: Number(raw.spBuyers ?? 0),
    spNewBuyers: Number(raw.spNewBuyers ?? 0),
    spProductSold: Number(raw.spProductSold ?? 0),
    spCommission,
    // Rate metrics recomputed from totals, never summed (CLAUDE.md).
    spRoi: ratio(spGmv, spCommission),
    spCoRate: ratio(spOrders, spClicks),
  }
}

/** Brand plus the PID dimension filters; the level scope is applied separately. */
function pidFilterClause(filters: PidFilters, params: Record<string, unknown>): string {
  const brandClause = buildFilterClause(filters.brand ? { brand: filters.brand } : {}, params)
  return brandClause + buildDetailClause(filters.detail, params)
}

function scopeClause(filters: PidFilters, params: Record<string, unknown>): string {
  if (!filters.scope?.length || !filters.scopeLevel) return ''
  params.scopes = filters.scope
  return ` AND ifNull(${LEVEL_COLUMNS[filters.scopeLevel]}, 'Unknown') IN {scopes:Array(String)}`
}

export async function getPidCategories(
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: PidFilters,
  level: PidLevel,
  prevRange?: { from?: string; to?: string },
): Promise<PidCategoriesResult> {
  const column = LEVEL_COLUMNS[level]
  const comparison = computeComparisonRange(from, to, basis, prevRange)
  const params: Record<string, unknown> = {
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const filterClause = pidFilterClause(filters, params)

  const gmvResult = await clickhouse.query({
    query: `
      SELECT
        ifNull(${column}, 'Unknown') AS name,
        sumIf(GMV, inCurrent) AS gmv,
        sumIf(GMV, inPrev) AS gmvPrev,${ORDER_METRICS_SQL},
        sumIf(GMV, inCurrent AND PILLAR = 'Livestream') AS livestream,
        sumIf(GMV, inPrev AND PILLAR = 'Livestream') AS livestreamPrev,
        sumIf(GMV, inCurrent AND PILLAR = 'Video') AS video,
        sumIf(GMV, inPrev AND PILLAR = 'Video') AS videoPrev,
        sumIf(GMV, inCurrent AND PILLAR = 'Product Card') AS productCard,
        sumIf(GMV, inPrev AND PILLAR = 'Product Card') AS productCardPrev
      FROM (
        SELECT
          ${column},
          PILLAR,
          GMV,
          ATTRIBUTED_ORDERS,
          ITEMS_SOLD,
          COMMISSION,
          (DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS inCurrent,
          (DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS inPrev
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${SHOPEE_SCOPE}
          AND IS_AFFILIATE = TRUE
          ${TWO_WINDOW_CLAUSE}
          ${filterClause}
      )
      GROUP BY name
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const spResult = await clickhouse.query({
    query: `
      SELECT name, ${SP_OUTER_COLUMNS}
      FROM (
        SELECT
          ifNull(${column}, 'Unknown') AS name,
          DATE AS date,
          PRODUCT_ID AS pid,
          ${SP_CHANNEL},
          ${SP_INNER_COLUMNS}
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${SHOPEE_SCOPE}
          AND DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}
          ${filterClause}
        GROUP BY name, date, pid, channel
      )
      GROUP BY name
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  type GmvRow = {
    name: string
    gmv: number
    gmvPrev: number
    livestream: number
    livestreamPrev: number
    video: number
    videoPrev: number
    productCard: number
    productCardPrev: number
  }

  const gmvRows = await gmvResult.json<GmvRow>()
  const spRows = await spResult.json<RawShopeeAttrs & { name: string }>()
  const spByName = new Map(spRows.map((r) => [r.name, r]))

  const totalGmv = gmvRows.reduce((acc, r) => acc + Number(r.gmv || 0), 0)

  const rows: PidCategoryRow[] = gmvRows
    .map((r) => {
      const gmv = Number(r.gmv || 0)
      const gmvPrev = Number(r.gmvPrev || 0)
      return {
        name: r.name,
        gmv,
        gmvPrev,
        deltaRp: gmv - gmvPrev,
        share: totalGmv > 0 ? gmv / totalGmv : 0,
        growth: pctDelta(gmv, gmvPrev),
        pillars: {
          livestream: Number(r.livestream || 0),
          video: Number(r.video || 0),
          productCard: Number(r.productCard || 0),
        },
        pillarGrowth: {
          livestream: pctDelta(Number(r.livestream || 0), Number(r.livestreamPrev || 0)),
          video: pctDelta(Number(r.video || 0), Number(r.videoPrev || 0)),
          productCard: pctDelta(Number(r.productCard || 0), Number(r.productCardPrev || 0)),
        },
        ...toOrderMetrics(r as unknown as Record<string, unknown>, gmv),
        ...toAttributes(spByName.get(r.name) ?? {}),
      }
    })
    .sort((a, b) => b.gmv - a.gmv)

  const sum = (pick: (r: PidCategoryRow) => number) => rows.reduce((acc, r) => acc + pick(r), 0)
  // Previous-period pillar totals come from the raw rows, which still carry the *Prev fields.
  const sumRaw = (pick: (r: GmvRow) => number) => gmvRows.reduce((acc, r) => acc + Number(pick(r) || 0), 0)
  const totalPrev = sum((r) => r.gmvPrev)

  const totalAttrs = toAttributes({
    spGmv: sum((r) => r.spGmv),
    spOrders: sum((r) => r.spOrders),
    spClicks: sum((r) => r.spClicks),
    spBuyers: sum((r) => r.spBuyers),
    spNewBuyers: sum((r) => r.spNewBuyers),
    spProductSold: sum((r) => r.spProductSold),
    spCommission: sum((r) => r.spCommission),
  })

  const total: PidCategoryRow = {
    name: 'SHOPEE TOTAL',
    gmv: totalGmv,
    gmvPrev: totalPrev,
    deltaRp: totalGmv - totalPrev,
    share: 1,
    growth: pctDelta(totalGmv, totalPrev),
    pillars: {
      livestream: sumRaw((r) => r.livestream),
      video: sumRaw((r) => r.video),
      productCard: sumRaw((r) => r.productCard),
    },
    pillarGrowth: {
      livestream: pctDelta(sumRaw((r) => r.livestream), sumRaw((r) => r.livestreamPrev)),
      video: pctDelta(sumRaw((r) => r.video), sumRaw((r) => r.videoPrev)),
      productCard: pctDelta(sumRaw((r) => r.productCard), sumRaw((r) => r.productCardPrev)),
    },
    ...sumOrderMetrics(rows, totalGmv),
    ...totalAttrs,
  }

  return {
    level,
    total,
    rows,
    current: { from, to },
    comparison: { ...comparison, basis },
  }
}

export async function getPidProducts(
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: PidFilters,
  prevRange?: { from?: string; to?: string },
): Promise<PidProductsResult> {
  const comparison = computeComparisonRange(from, to, basis, prevRange)
  const params: Record<string, unknown> = {
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const filterClause = pidFilterClause(filters, params)

  const gmvResult = await clickhouse.query({
    query: `
      SELECT
        pid,
        any(category) AS category,
        any(subCategory) AS subCategory,
        any(format) AS format,
        sumIf(GMV, inCurrent) AS gmv,
        sumIf(GMV, inPrev) AS gmvPrev,${ORDER_METRICS_SQL},
        sumIf(GMV, inCurrent AND PILLAR = 'Livestream') AS livestream,
        sumIf(GMV, inCurrent AND PILLAR = 'Video') AS video,
        sumIf(GMV, inCurrent AND PILLAR = 'Product Card') AS productCard,
        uniqExactIf(AFFILIATE_USERNAME, inCurrent) AS creators
      FROM (
        SELECT
          PRODUCT_ID AS pid,
          ifNull(PID_CATEGORY, 'Unknown') AS category,
          ifNull(PID_SUB_CATEGORY, 'Unknown') AS subCategory,
          ifNull(PID_FORMAT, 'Unknown') AS format,
          PILLAR,
          GMV,
          ATTRIBUTED_ORDERS,
          ITEMS_SOLD,
          COMMISSION,
          AFFILIATE_USERNAME,
          (DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS inCurrent,
          (DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS inPrev
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${SHOPEE_SCOPE}
          AND IS_AFFILIATE = TRUE
          ${TWO_WINDOW_CLAUSE}
          ${filterClause}
      )
      GROUP BY pid
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const spResult = await clickhouse.query({
    query: `
      SELECT pid, ${SP_OUTER_COLUMNS}
      FROM (
        SELECT
          PRODUCT_ID AS pid,
          DATE AS date,
          ${SP_CHANNEL},
          ${SP_INNER_COLUMNS}
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${SHOPEE_SCOPE}
          AND DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}
          ${filterClause}
        GROUP BY pid, date, channel
      )
      GROUP BY pid
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  type ProductGmvRow = {
    pid: string
    category: string
    subCategory: string
    format: string
    gmv: number
    gmvPrev: number
    livestream: number
    video: number
    productCard: number
    creators: number
  }

  const gmvRows = await gmvResult.json<ProductGmvRow>()
  const spRows = await spResult.json<RawShopeeAttrs & { pid: string }>()
  // Names come from the warm cache: resolving them inline cost ~4.8s, 70% of the query above.
  const { names } = await getNames({
    key: 'shopee-pid-product-name',
    idColumn: 'PRODUCT_ID',
    scope: SHOPEE_SCOPE,
    nameColumn: 'PRODUCT_NAME',
  })
  const spByPid = new Map(spRows.map((r) => [r.pid, r]))

  const totalGmv = gmvRows.reduce((acc, r) => acc + Number(r.gmv || 0), 0)
  const scopeKey = filters.scopeLevel ?? 'category'

  const rows: PidProductRow[] = gmvRows
    .map((r) => {
      const gmv = Number(r.gmv || 0)
      const gmvPrev = Number(r.gmvPrev || 0)
      const levelValue =
        scopeKey === 'category' ? r.category : scopeKey === 'subcategory' ? r.subCategory : r.format

      return {
        pid: r.pid,
        name: names.get(r.pid) ?? r.pid,
        category: r.category,
        subCategory: r.subCategory,
        format: r.format,
        inScope: !filters.scope?.length || filters.scope.includes(levelValue),
        gmv,
        gmvPrev,
        growth: pctDelta(gmv, gmvPrev),
        share: totalGmv > 0 ? gmv / totalGmv : 0,
        creators: Number(r.creators || 0),
        pillars: {
          livestream: Number(r.livestream || 0),
          video: Number(r.video || 0),
          productCard: Number(r.productCard || 0),
        },
        ...toOrderMetrics(r as unknown as Record<string, unknown>, gmv),
        ...toAttributes(spByPid.get(r.pid) ?? {}),
      }
    })
    .sort((a, b) => b.gmv - a.gmv)

  const inScope = rows.filter((r) => r.inScope)

  return {
    rows,
    scope: filters.scope?.join(', ') ?? null,
    countProduct: inScope.length,
    // "Profit" used to mean GMV > 0, which every product with a sale meets; growth is the question.
    countGrowingProduct: inScope.filter((r) => r.gmv > r.gmvPrev).length,
    countDecliningProduct: inScope.filter((r) => r.growth !== null && r.growth < 0).length,
    countScopeProduct: inScope.length,
  }
}

export async function getPidTrend(
  from: string,
  to: string,
  filters: PidFilters,
  granularity: TrendGranularity,
): Promise<PidTrendPoint[]> {
  const params: Record<string, unknown> = { from, to }
  const filterClause = pidFilterClause(filters, params)
  const scope = scopeClause(filters, params)
  const bucket = bucketExpression(granularity)

  const gmvResult = await clickhouse.query({
    query: `
      SELECT ${bucket} AS bucket,${TREND_METRICS_SQL}
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${SHOPEE_SCOPE}
        AND IS_AFFILIATE = TRUE
        AND DATE >= {from:Date} AND DATE <= {to:Date}
        ${filterClause}${scope}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const gmvRows = await gmvResult.json<Record<string, unknown> & { bucket: string }>()
  return gmvRows.map((r) => ({ bucket: r.bucket, ...toTrendMetrics(r) }))
}

export async function getPidProductDetail(
  pids: string[],
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: PidFilters,
  granularity: TrendGranularity,
  prevRange?: { from?: string; to?: string },
): Promise<PidProductDetail | null> {
  const comparison = computeComparisonRange(from, to, basis, prevRange)
  const params: Record<string, unknown> = {
    pids,
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const filterClause = pidFilterClause(filters, params)

  const infoResult = await clickhouse.query({
    query: `
      SELECT
        PRODUCT_ID AS pid,
        argMaxIf(PRODUCT_NAME, (ETL_BATCH_TIME, DATE), PRODUCT_NAME IS NOT NULL) AS name,
        any(ifNull(PID_CATEGORY, 'Unknown')) AS category,
        any(ifNull(PID_SUB_CATEGORY, 'Unknown')) AS subCategory,
        any(ifNull(PID_FORMAT, 'Unknown')) AS format,
        sumIf(GMV, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS gmv,
        sumIf(GMV, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS gmvPrev,
        sumIf(ATTRIBUTED_ORDERS, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS orders,
        sumIf(ATTRIBUTED_ORDERS, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS ordersPrev
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${SHOPEE_SCOPE}
        AND IS_AFFILIATE = TRUE
        AND PRODUCT_ID IN {pids:Array(String)}
        ${TWO_WINDOW_CLAUSE}
        ${filterClause}
      GROUP BY pid
      ORDER BY gmv DESC
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const infoRows = await infoResult.json<{
    pid: string
    name: string
    category: string
    subCategory: string
    format: string
    gmv: number
    gmvPrev: number
    orders: number
    ordersPrev: number
  }>()
  if (infoRows.length === 0) return null

  // Creators are counted across the whole selection, so someone selling two of the
  // picked products still counts once.
  const creatorResult = await clickhouse.query({
    query: `
      SELECT
        uniqExactIf(AFFILIATE_USERNAME, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS creators,
        uniqExactIf(AFFILIATE_USERNAME, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS creatorsPrev
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${SHOPEE_SCOPE}
        AND IS_AFFILIATE = TRUE
        AND PRODUCT_ID IN {pids:Array(String)}
        ${TWO_WINDOW_CLAUSE}
        ${filterClause}
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const creatorCounts = (await creatorResult.json<{ creators: number; creatorsPrev: number }>())[0]
  const creators = Number(creatorCounts?.creators ?? 0)
  const creatorsPrev = Number(creatorCounts?.creatorsPrev ?? 0)

  const members = infoRows.map((r) => ({ pid: r.pid, name: r.name, gmv: Number(r.gmv || 0) }))
  const shared = (values: string[]): string => {
    const unique = [...new Set(values)]
    return unique.length === 1 ? (unique[0] as string) : 'Beragam'
  }
  const info = {
    name: members.length === 1 ? (members[0]?.name ?? '') : `${members.length} produk digabung`,
    category: shared(infoRows.map((r) => r.category)),
    subCategory: shared(infoRows.map((r) => r.subCategory)),
    format: shared(infoRows.map((r) => r.format)),
    gmv: infoRows.reduce((acc, r) => acc + Number(r.gmv || 0), 0),
    gmvPrev: infoRows.reduce((acc, r) => acc + Number(r.gmvPrev || 0), 0),
    orders: infoRows.reduce((acc, r) => acc + Number(r.orders || 0), 0),
    ordersPrev: infoRows.reduce((acc, r) => acc + Number(r.ordersPrev || 0), 0),
    creators,
  }

  const spResult = await clickhouse.query({
    query: `
      SELECT
        ${SP_WINDOW_COLUMNS('inCurrent', 'Cur')},
        ${SP_WINDOW_COLUMNS('inPrev', 'Prev')}
      FROM (
        SELECT
          DATE AS date,
          PRODUCT_ID AS pid,
          ${SP_CHANNEL},
          (DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS inCurrent,
          (DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS inPrev,
          ${SP_INNER_COLUMNS}
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${SHOPEE_SCOPE}
          AND PRODUCT_ID IN {pids:Array(String)}
          ${TWO_WINDOW_CLAUSE}
          ${filterClause}
        GROUP BY date, pid, channel, inCurrent, inPrev
      )
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const spRaw = (await spResult.json<Record<string, number>>())[0]
  const curAttrs: RawShopeeAttrs = {}
  const prevAttrs: RawShopeeAttrs = {}
  for (const k of ['spGmv', 'spOrders', 'spClicks', 'spBuyers', 'spNewBuyers', 'spProductSold', 'spCommission'] as const) {
    curAttrs[k] = Number(spRaw?.[`${k}Cur`] ?? 0)
    prevAttrs[k] = Number(spRaw?.[`${k}Prev`] ?? 0)
  }

  const pillarResult = await clickhouse.query({
    query: `
      SELECT
        ifNull(PILLAR, 'Unknown') AS name,
        sumIf(GMV, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS gmv,
        sumIf(GMV, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS gmvPrev
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${SHOPEE_SCOPE}
        AND IS_AFFILIATE = TRUE
        AND PRODUCT_ID IN {pids:Array(String)}
        ${TWO_WINDOW_CLAUSE}
        ${filterClause}
      GROUP BY name
      ORDER BY gmv DESC
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const pillarRows = await pillarResult.json<{ name: string; gmv: number; gmvPrev: number }>()

  const gmv = Number(info.gmv || 0)
  const pillarTotal = pillarRows.reduce((acc, p) => acc + Number(p.gmv || 0), 0)
  const pillars: PidPillarContribution[] = pillarRows.map((p) => {
    const pGmv = Number(p.gmv || 0)
    const pPrev = Number(p.gmvPrev || 0)
    return {
      name: p.name,
      gmv: pGmv,
      gmvPrev: pPrev,
      share: pillarTotal > 0 ? pGmv / pillarTotal : 0,
      growth: pctDelta(pGmv, pPrev),
      delta: pGmv - pPrev,
    }
  })

  const [trend, variants] = await Promise.all([
    getPidTrendForProduct(pids, from, to, filters, granularity),
    getVariantContribution(SHOPEE_SCOPE, filterClause, params),
  ])

  return {
    pids: members.map((m) => m.pid),
    name: info.name,
    members,
    category: info.category,
    subCategory: info.subCategory,
    format: info.format,
    gmv,
    gmvPrev: Number(info.gmvPrev || 0),
    growth: pctDelta(gmv, Number(info.gmvPrev || 0)),
    creators: Number(info.creators || 0),
    creatorsPrev,
    orders: Number(info.orders || 0),
    ordersPrev: Number(info.ordersPrev || 0),
    attributes: toAttributes(curAttrs),
    attributesPrev: toAttributes(prevAttrs),
    trend,
    pillars,
    variants,
  }
}

async function getPidTrendForProduct(
  pids: string[],
  from: string,
  to: string,
  filters: PidFilters,
  granularity: TrendGranularity,
): Promise<PidTrendPoint[]> {
  const params: Record<string, unknown> = { pids, from, to }
  const filterClause = pidFilterClause(filters, params)
  const bucket = bucketExpression(granularity)

  const result = await clickhouse.query({
    query: `
      SELECT ${bucket} AS bucket,${TREND_METRICS_SQL}
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${SHOPEE_SCOPE}
        AND IS_AFFILIATE = TRUE
        AND PRODUCT_ID IN {pids:Array(String)}
        AND DATE >= {from:Date} AND DATE <= {to:Date}
        ${filterClause}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const rows = await result.json<Record<string, unknown> & { bucket: string }>()
  return rows.map((r) => ({ bucket: r.bucket, ...toTrendMetrics(r) }))
}

export async function getPidTopCreators(
  from: string,
  to: string,
  filters: PidFilters,
  pillar: string | null,
  managed: boolean | null,
  limit: number,
  /** When set, the table answers "who sells THIS product" instead of "who sells in this scope". */
  pids?: string[],
): Promise<PidCreatorsResult> {
  const params: Record<string, unknown> = { from, to }
  const filterClause = pidFilterClause(filters, params)
  const scope = scopeClause(filters, params)

  let extra = ''
  if (pids?.length) {
    params.creatorPids = pids
    extra += ` AND PRODUCT_ID IN {creatorPids:Array(String)}`
  }
  if (pillar) {
    // Distinct from the detail filter's {pillar:Array(String)}; sharing the name made ClickHouse
    // parse this single value against the array type and fail the whole query.
    params.creatorPillar = pillar
    extra += ` AND ifNull(PILLAR, 'Unknown') = {creatorPillar:String}`
  }
  if (managed !== null) {
    params.managed = managed ? 1 : 0
    extra += ` AND IS_MANAGED_CREATOR = {managed:UInt8}`
  }

  const result = await clickhouse.query({
    query: `
      SELECT
        AFFILIATE_USERNAME AS username,
        MAX(IS_MANAGED_CREATOR) AS isManaged,
        SUM(GMV) AS gmv,
        sumIf(GMV, PILLAR = 'Livestream') AS livestream,
        sumIf(GMV, PILLAR = 'Video') AS video,
        sumIf(GMV, PILLAR = 'Product Card') AS productCard,
        SUM(ATTRIBUTED_ORDERS) AS orders,
        SUM(ITEMS_SOLD) AS itemsSold,
        SUM(COMMISSION) AS commission
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${SHOPEE_SCOPE}
        AND IS_AFFILIATE = TRUE
        AND AFFILIATE_USERNAME IS NOT NULL
        AND DATE >= {from:Date} AND DATE <= {to:Date}
        ${filterClause}${scope}${extra}
      GROUP BY username
      ORDER BY gmv DESC
      LIMIT ${Math.min(limit, 100)}
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const raw = await result.json<{
    username: string
    isManaged: number
    gmv: number
    livestream: number
    video: number
    productCard: number
    orders: number
    itemsSold: number
    commission: number
  }>()

  const totalResult = await clickhouse.query({
    query: `
      SELECT SUM(GMV) AS gmv
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${SHOPEE_SCOPE}
        AND IS_AFFILIATE = TRUE
        AND DATE >= {from:Date} AND DATE <= {to:Date}
        ${filterClause}${scope}${extra}
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const totalRows = await totalResult.json<{ gmv: number }>()
  const totalGmv = Number(totalRows[0]?.gmv ?? 0)

  const rows: PidCreatorRow[] = raw.map((r) => {
    const gmv = Number(r.gmv || 0)
    const orders = Number(r.orders || 0)
    return {
      username: r.username,
      isManaged: Boolean(r.isManaged),
      gmv,
      pillars: {
        livestream: Number(r.livestream || 0),
        video: Number(r.video || 0),
        productCard: Number(r.productCard || 0),
      },
      share: totalGmv > 0 ? gmv / totalGmv : 0,
      orders,
      itemsSold: Number(r.itemsSold || 0),
      commission: Number(r.commission || 0),
      aov: orders > 0 ? gmv / orders : 0,
    }
  })

  const top10 = rows.slice(0, 10).reduce((acc, r) => acc + r.gmv, 0)

  return {
    rows,
    totalGmv,
    concentrationTop10: totalGmv > 0 ? top10 / totalGmv : 0,
  }
}

export async function getOpportunityCreators(
  pids: string[],
  from: string,
  to: string,
  filters: PidFilters,
  limit: number,
  pillar?: string,
  level: SimilarityLevel = 'subcategory',
): Promise<OpportunityCreatorsResult> {
  const params: Record<string, unknown> = {}
  return findOpportunityCreators({
    scope: SHOPEE_SCOPE,
    idColumn: 'PRODUCT_ID',
    similarityColumn: similarityColumn('PID', level),
    filterClause: pidFilterClause(filters, params),
    ids: pids,
    from,
    to,
    limit,
    pillar,
    params,
  })
}

export async function getPidCreatorDetail(
  username: string,
  from: string,
  to: string,
  filters: PidFilters,
  granularity: TrendGranularity,
): Promise<CreatorDetail> {
  const params: Record<string, unknown> = {}
  return getCreatorDetail({
    username,
    scope: SHOPEE_SCOPE,
    filterClause: pidFilterClause(filters, params),
    idColumn: 'PRODUCT_ID',
    nameCacheKey: 'shopee-pid-product-name',
    nameColumn: 'PRODUCT_NAME',
    from,
    to,
    granularity,
    params,
  })
}
