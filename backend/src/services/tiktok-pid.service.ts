import { clickhouse } from '../lib/clickhouse'
import { getProductImages } from './product-image.service'
import { getCreatorDetail } from './creator-detail.service'
import { findOpportunityCreators, similarityColumn, type SimilarityLevel } from './opportunity.service'
import { getNames } from '../lib/name-cache'
import { getVariantContribution } from '../lib/variants'
import { getCreatorLeadersByProduct, type CreatorLeadersResult } from '../lib/creator-leaders'
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
import type { OpportunityCreatorsResult, PidPillarContribution } from '../types/shopee-pid'
import type {
  PidFilters,
  PidLevel,
  TiktokAttributes,
  TtCategoriesResult,
  TtCategoryRow,
  TtCreatorRow,
  TtCreatorsResult,
  TtProductDetail,
  TtProductRow,
  TtProductsResult,
  TtTrendPoint,
} from '../types/tiktok-pid'

const LEVEL_COLUMNS: Record<PidLevel, string> = {
  category: 'PID_CATEGORY',
  subcategory: 'PID_SUB_CATEGORY',
  format: 'PID_FORMAT',
}

// The marketplace is spelled "Tiktok" in this table, not "TikTok".
const TIKTOK_SCOPE = `REGION_CODE = 'id' AND ITEM_MARKETPLACE_FLAG = TRUE AND MARKETPLACE_NAME = 'Tiktok'`

/**
 * TT_* columns are product attributes repeated across every creator/pillar row for the same
 * product+date, so they need MAX-then-SUM exactly like SP_*. Unlike Shopee they carry no
 * channel split: every TT_* column was measured to hold exactly one distinct value per
 * (product, date), so product+date is the whole grain here.
 */
const TT_INNER_COLUMNS = `
  MAX(TT_AFF_TOTAL_GMV) AS ttGmv,
  MAX(TT_AFF_TOTAL_ORDERS) AS ttOrders,
  MAX(TT_AFF_TOTAL_ITEMS_SOLD) AS ttItemsSold,
  MAX(TT_PRODUCT_IMPRESSIONS) AS ttImpressions,
  MAX(TT_PRODUCT_CLICKS) AS ttClicks,
  MAX(TT_ADD_TO_CART) AS ttAddToCart,
  MAX(TT_ADD_TO_CART_USERS) AS ttAddToCartUsers,
  MAX(TT_VIDEOS) AS ttVideos,
  MAX(TT_LIVE_STREAMS) AS ttLiveStreams,
  MAX(TT_AVG_DAILY_CUSTOMERS) AS ttCustomers`

/** Additive TT_ metrics, summed once the per-product+date MAX has collapsed the duplicates. */
const TT_SUM_COLUMNS = `
  SUM(ttGmv) AS ttGmv,
  SUM(ttOrders) AS ttOrders,
  SUM(ttItemsSold) AS ttItemsSold,
  SUM(ttImpressions) AS ttImpressions,
  SUM(ttClicks) AS ttClicks,
  SUM(ttAddToCart) AS ttAddToCart,
  SUM(ttAddToCartUsers) AS ttAddToCartUsers,
  SUM(ttVideos) AS ttVideos,
  SUM(ttLiveStreams) AS ttLiveStreams`

/** Per-window sums; a date sits in exactly one window so the flag never splits a group. */
const TT_WINDOW_COLUMNS = (flag: string, suffix: string) =>
  ['ttGmv', 'ttOrders', 'ttItemsSold', 'ttImpressions', 'ttClicks', 'ttAddToCart', 'ttAddToCartUsers', 'ttVideos', 'ttLiveStreams']
    .map((c) => `sumIf(${c}, ${flag}) AS ${c}${suffix}`)
    .join(', ')

interface RawTtAttrs {
  ttGmv?: number
  ttOrders?: number
  ttItemsSold?: number
  ttImpressions?: number
  ttClicks?: number
  ttAddToCart?: number
  ttAddToCartUsers?: number
  ttVideos?: number
  ttLiveStreams?: number
  ttCustomers?: number
}

const EMPTY_ATTRS: Required<RawTtAttrs> = {
  ttGmv: 0,
  ttOrders: 0,
  ttItemsSold: 0,
  ttImpressions: 0,
  ttClicks: 0,
  ttAddToCart: 0,
  ttAddToCartUsers: 0,
  ttVideos: 0,
  ttLiveStreams: 0,
  ttCustomers: 0,
}

/**
 * @param commission internal COMMISSION for the same slice — TT_AFF_CENTER_EST_COMMISSION is
 *   entirely NULL, so ROI and commission rate are computed against internal GMV instead.
 */
function toAttributes(raw: RawTtAttrs, gmv: number, commission: number): TiktokAttributes {
  const ttGmv = Number(raw.ttGmv ?? 0)
  const ttOrders = Number(raw.ttOrders ?? 0)
  const ttClicks = Number(raw.ttClicks ?? 0)
  const ttImpressions = Number(raw.ttImpressions ?? 0)
  const ttAddToCart = Number(raw.ttAddToCart ?? 0)
  const ttVideos = Number(raw.ttVideos ?? 0)
  const ttLiveStreams = Number(raw.ttLiveStreams ?? 0)
  const ttContentCount = ttVideos + ttLiveStreams

  return {
    ttGmv,
    ttOrders,
    ttItemsSold: Number(raw.ttItemsSold ?? 0),
    ttImpressions,
    ttClicks,
    ttAddToCart,
    ttAddToCartUsers: Number(raw.ttAddToCartUsers ?? 0),
    ttVideos,
    ttLiveStreams,
    ttContentCount,
    ttAvgDailyCustomers: Number(raw.ttCustomers ?? 0),
    ttCommission: commission,
    // Rate metrics recomputed from totals, never summed (CLAUDE.md).
    ttRoi: ratio(gmv, commission),
    ttCommissionRate: ratio(commission, gmv),
    ttCoRate: ratio(ttOrders, ttClicks),
    ttCtr: ratio(ttClicks, ttImpressions),
    ttAtcRate: ratio(ttOrders, ttAddToCart),
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

/** Sums the additive fields and averages the daily-customer one across the days present. */
function foldDays(days: RawTtAttrs[]): Required<RawTtAttrs> {
  if (days.length === 0) return { ...EMPTY_ATTRS }
  const out = { ...EMPTY_ATTRS }
  for (const d of days) {
    out.ttGmv += Number(d.ttGmv ?? 0)
    out.ttOrders += Number(d.ttOrders ?? 0)
    out.ttItemsSold += Number(d.ttItemsSold ?? 0)
    out.ttImpressions += Number(d.ttImpressions ?? 0)
    out.ttClicks += Number(d.ttClicks ?? 0)
    out.ttAddToCart += Number(d.ttAddToCart ?? 0)
    out.ttAddToCartUsers += Number(d.ttAddToCartUsers ?? 0)
    out.ttVideos += Number(d.ttVideos ?? 0)
    out.ttLiveStreams += Number(d.ttLiveStreams ?? 0)
    out.ttCustomers += Number(d.ttCustomers ?? 0)
  }
  out.ttCustomers = out.ttCustomers / days.length
  return out
}

export async function getTtCategories(
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: PidFilters,
  level: PidLevel,
  prevRange?: { from?: string; to?: string },
): Promise<TtCategoriesResult> {
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
        sumIf(COMMISSION, inCurrent) AS commission,
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
          COMMISSION,
          ATTRIBUTED_ORDERS,
          ITEMS_SOLD,
          (DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS inCurrent,
          (DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS inPrev
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${TIKTOK_SCOPE}
          AND IS_AFFILIATE = TRUE
          ${TWO_WINDOW_CLAUSE}
          ${filterClause}
      )
      GROUP BY name
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  // Returned one row per (name, date) rather than per name: the daily grain is what makes the
  // customer average — and the page total's average — exact instead of an average of averages.
  const ttResult = await clickhouse.query({
    query: `
      SELECT name, date, ${TT_SUM_COLUMNS}, SUM(ttCustomers) AS ttCustomers
      FROM (
        SELECT
          ifNull(${column}, 'Unknown') AS name,
          DATE AS date,
          PRODUCT_ID AS pid,
          ${TT_INNER_COLUMNS}
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${TIKTOK_SCOPE}
          AND DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}
          ${filterClause}
        GROUP BY name, date, pid
      )
      GROUP BY name, date
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  type GmvRow = {
    name: string
    gmv: number
    gmvPrev: number
    commission: number
    livestream: number
    livestreamPrev: number
    video: number
    videoPrev: number
    productCard: number
    productCardPrev: number
  }

  const gmvRows = await gmvResult.json<GmvRow>()
  const ttDayRows = await ttResult.json<RawTtAttrs & { name: string; date: string }>()

  const byName = new Map<string, RawTtAttrs[]>()
  const byDate = new Map<string, RawTtAttrs[]>()
  for (const r of ttDayRows) {
    if (!byName.has(r.name)) byName.set(r.name, [])
    byName.get(r.name)?.push(r)
    if (!byDate.has(r.date)) byDate.set(r.date, [])
    byDate.get(r.date)?.push(r)
  }

  const totalGmv = gmvRows.reduce((acc, r) => acc + Number(r.gmv || 0), 0)

  const rows: TtCategoryRow[] = gmvRows
    .map((r) => {
      const gmv = Number(r.gmv || 0)
      const gmvPrev = Number(r.gmvPrev || 0)
      const commission = Number(r.commission || 0)
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
        ...toAttributes(foldDays(byName.get(r.name) ?? []), gmv, commission),
      }
    })
    .sort((a, b) => b.gmv - a.gmv)

  const sumRaw = (pick: (r: GmvRow) => number) => gmvRows.reduce((acc, r) => acc + Number(pick(r) || 0), 0)
  const totalPrev = sumRaw((r) => r.gmvPrev)
  const totalCommission = sumRaw((r) => r.commission)

  // Collapse each day across every category first, then average — so the total's customer
  // figure is a real daily average and not the sum of per-category averages.
  const totalDays = [...byDate.values()].map((dayRows) => {
    const folded = foldDays(dayRows)
    return { ...folded, ttCustomers: dayRows.reduce((acc, r) => acc + Number(r.ttCustomers ?? 0), 0) }
  })

  const total: TtCategoryRow = {
    name: 'TIKTOK TOTAL',
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
    ...toAttributes(foldDays(totalDays), totalGmv, totalCommission),
  }

  return {
    level,
    total,
    rows,
    current: { from, to },
    comparison: { ...comparison, basis },
  }
}

export async function getTtProducts(
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: PidFilters,
  prevRange?: { from?: string; to?: string },
): Promise<TtProductsResult> {
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
        sumIf(COMMISSION, inCurrent) AS commission,
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
          COMMISSION,
          ATTRIBUTED_ORDERS,
          ITEMS_SOLD,
          AFFILIATE_USERNAME,
          (DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS inCurrent,
          (DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS inPrev
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${TIKTOK_SCOPE}
          AND IS_AFFILIATE = TRUE
          ${TWO_WINDOW_CLAUSE}
          ${filterClause}
      )
      GROUP BY pid
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  // The day grain is collapsed in SQL here rather than in Node as the category query does:
  // ~900 products x the window's days would be a large payload for no gain, and a product's
  // daily average needs no cross-product folding first.
  const ttResult = await clickhouse.query({
    query: `
      SELECT pid, ${TT_SUM_COLUMNS}, AVG(ttCustomers) AS ttCustomers
      FROM (
        SELECT
          PRODUCT_ID AS pid,
          DATE AS date,
          ${TT_INNER_COLUMNS}
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${TIKTOK_SCOPE}
          AND DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}
          ${filterClause}
        GROUP BY pid, date
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
    commission: number
    livestream: number
    video: number
    productCard: number
    creators: number
  }

  const gmvRows = await gmvResult.json<ProductGmvRow>()
  const ttRows = await ttResult.json<RawTtAttrs & { pid: string }>()
  // Names come from the warm cache: resolving them inline cost ~4.8s, 70% of the query above.
  const { names } = await getNames({
    key: 'tiktok-pid-product-name',
    idColumn: 'PRODUCT_ID',
    scope: TIKTOK_SCOPE,
    nameColumn: 'PRODUCT_NAME',
  })
  const ttByPid = new Map(ttRows.map((r) => [r.pid, r]))

  const totalGmv = gmvRows.reduce((acc, r) => acc + Number(r.gmv || 0), 0)
  const scopeKey = filters.scopeLevel ?? 'category'

  const rows: TtProductRow[] = gmvRows
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
        ...toAttributes(ttByPid.get(r.pid) ?? {}, gmv, Number(r.commission || 0)),
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

export async function getTtTrend(
  from: string,
  to: string,
  filters: PidFilters,
  granularity: TrendGranularity,
): Promise<TtTrendPoint[]> {
  const params: Record<string, unknown> = { from, to }
  const filterClause = pidFilterClause(filters, params)
  const scope = scopeClause(filters, params)
  const bucket = bucketExpression(granularity)

  const gmvResult = await clickhouse.query({
    query: `
      SELECT ${bucket} AS bucket,${TREND_METRICS_SQL}
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${TIKTOK_SCOPE}
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

export async function getTtProductDetail(
  pids: string[],
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: PidFilters,
  granularity: TrendGranularity,
  prevRange?: { from?: string; to?: string },
): Promise<TtProductDetail | null> {
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
        sumIf(COMMISSION, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS commission,
        sumIf(ATTRIBUTED_ORDERS, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS orders,
        sumIf(ATTRIBUTED_ORDERS, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS ordersPrev
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${TIKTOK_SCOPE}
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
    commission: number
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
      WHERE ${TIKTOK_SCOPE}
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

  const images = await getProductImages('tiktok', infoRows.map((r) => r.pid))
  const members = infoRows.map((r) => ({
    pid: r.pid,
    name: r.name,
    gmv: Number(r.gmv || 0),
    image: images.get(r.pid) ?? null,
  }))
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
    commission: infoRows.reduce((acc, r) => acc + Number(r.commission || 0), 0),
    orders: infoRows.reduce((acc, r) => acc + Number(r.orders || 0), 0),
    ordersPrev: infoRows.reduce((acc, r) => acc + Number(r.ordersPrev || 0), 0),
    creators,
  }

  // Grouped by product as well as date: without the product in the inner GROUP BY, a
  // multi-product selection would take MAX across products instead of summing them.
  const ttResult = await clickhouse.query({
    query: `
      SELECT
        ${TT_WINDOW_COLUMNS('inCurrent', 'Cur')}, avgIf(ttCustomers, inCurrent) AS ttCustomersCur,
        ${TT_WINDOW_COLUMNS('inPrev', 'Prev')}, avgIf(ttCustomers, inPrev) AS ttCustomersPrev
      FROM (
        SELECT date, inCurrent, inPrev, ${TT_SUM_COLUMNS}, SUM(ttCustomers) AS ttCustomers
        FROM (
          SELECT
            DATE AS date,
            PRODUCT_ID AS pid,
            (DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS inCurrent,
            (DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS inPrev,
            ${TT_INNER_COLUMNS}
          FROM ${TABLE_SUMMARY_ORDER}
          WHERE ${TIKTOK_SCOPE}
            AND PRODUCT_ID IN {pids:Array(String)}
            ${TWO_WINDOW_CLAUSE}
            ${filterClause}
          GROUP BY date, pid, inCurrent, inPrev
        )
        GROUP BY date, inCurrent, inPrev
      )
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const ttRaw = (await ttResult.json<Record<string, number>>())[0]
  const curAttrs: RawTtAttrs = {}
  const prevAttrs: RawTtAttrs = {}
  for (const k of ['ttGmv', 'ttOrders', 'ttItemsSold', 'ttImpressions', 'ttClicks', 'ttAddToCart', 'ttAddToCartUsers', 'ttVideos', 'ttLiveStreams', 'ttCustomers'] as const) {
    curAttrs[k] = Number(ttRaw?.[`${k}Cur`] ?? 0)
    prevAttrs[k] = Number(ttRaw?.[`${k}Prev`] ?? 0)
  }

  const pillarResult = await clickhouse.query({
    query: `
      SELECT
        ifNull(PILLAR, 'Unknown') AS name,
        sumIf(GMV, DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS gmv,
        sumIf(GMV, DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS gmvPrev
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${TIKTOK_SCOPE}
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
    getTtTrendForProduct(pids, from, to, filters, granularity),
    getVariantContribution(TIKTOK_SCOPE, filterClause, params),
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
    attributes: toAttributes(curAttrs, gmv, Number(info.commission || 0)),
    attributesPrev: toAttributes(prevAttrs, Number(info.gmvPrev || 0), 0),
    trend,
    pillars,
    variants,
  }
}

async function getTtTrendForProduct(
  pids: string[],
  from: string,
  to: string,
  filters: PidFilters,
  granularity: TrendGranularity,
): Promise<TtTrendPoint[]> {
  const params: Record<string, unknown> = { pids, from, to }
  const filterClause = pidFilterClause(filters, params)
  const bucket = bucketExpression(granularity)

  const result = await clickhouse.query({
    query: `
      SELECT ${bucket} AS bucket,${TREND_METRICS_SQL}
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${TIKTOK_SCOPE}
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

export async function getTtTopCreators(
  from: string,
  to: string,
  filters: PidFilters,
  pillar: string | null,
  managed: boolean | null,
  limit: number,
  /** When set, the table answers "who sells THIS product" instead of "who sells in this scope". */
  pids?: string[],
): Promise<TtCreatorsResult> {
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
      WHERE ${TIKTOK_SCOPE}
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
      WHERE ${TIKTOK_SCOPE}
        AND IS_AFFILIATE = TRUE
        AND DATE >= {from:Date} AND DATE <= {to:Date}
        ${filterClause}${scope}${extra}
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const totalRows = await totalResult.json<{ gmv: number }>()
  const totalGmv = Number(totalRows[0]?.gmv ?? 0)

  const rows: TtCreatorRow[] = raw.map((r) => {
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

export async function getTtOpportunityCreators(
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
    scope: TIKTOK_SCOPE,
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

export async function getTtCreatorDetail(
  username: string,
  from: string,
  to: string,
  filters: PidFilters,
  granularity: TrendGranularity,
): Promise<CreatorDetail> {
  const params: Record<string, unknown> = {}
  return getCreatorDetail({
    username,
    scope: TIKTOK_SCOPE,
    filterClause: pidFilterClause(filters, params),
    idColumn: 'PRODUCT_ID',
    nameCacheKey: 'tiktok-pid-product-name',
    nameColumn: 'PRODUCT_NAME',
    from,
    to,
    granularity,
    params,
  })
}

/** Each summary product's own top creators, with growth against the comparison window. */
export async function getTtProductCreatorLeaders(
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: PidFilters,
  pids: string[],
  prevRange?: { from?: string; to?: string },
): Promise<Record<string, CreatorLeadersResult>> {
  const comparison = computeComparisonRange(from, to, basis, prevRange)
  const params: Record<string, unknown> = {
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  return getCreatorLeadersByProduct(TIKTOK_SCOPE, pidFilterClause(filters, params), params, pids)
}
