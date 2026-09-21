import { clickhouse } from '../lib/clickhouse'
import { getCreatorDetail } from './creator-detail.service'
import { findOpportunityCreators, similarityColumn, type SimilarityLevel } from './opportunity.service'
import { getNames } from '../lib/name-cache'
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
} from '../lib/query-helpers'
import type { ComparisonBasis, TrendGranularity } from '../types/overview'
import type { CreatorDetail } from '../types/creator-detail'
import type { OpportunityCreatorsResult } from '../types/shopee-pid'
import type {
  MarketplaceSplit,
  SkuCategoriesResult,
  SkuCategoryRow,
  SkuCreatorRow,
  SkuCreatorsResult,
  SkuDetail,
  SkuFilterOptionsResult,
  SkuFilters,
  SkuLevel,
  SkuPidContribution,
  SkuProductsResult,
  SkuAttributeBase,
  SkuRow,
  SkuTotals,
  SkuTrendPoint,
} from '../types/sku'

/**
 * Both attribute families. PRODUCT_* is the barcode's own classification (the default, and the
 * finer of the two — one PID can map to several SKUs); PID_* is how the listing is classified,
 * which is what the Shopee and TikTok PID pages group by.
 */
const LEVEL_COLUMNS: Record<SkuAttributeBase, Record<SkuLevel, string>> = {
  product: {
    category: 'PRODUCT_CATEGORY',
    subcategory: 'PRODUCT_SUB_CATEGORY',
    format: 'PRODUCT_FORMAT',
  },
  pid: {
    category: 'PID_CATEGORY',
    subcategory: 'PID_SUB_CATEGORY',
    format: 'PID_FORMAT',
  },
}

function attributeBase(filters: SkuFilters): SkuAttributeBase {
  return filters.attributeBase === 'pid' ? 'pid' : 'product'
}

function levelColumn(filters: SkuFilters, level: SkuLevel): string {
  return LEVEL_COLUMNS[attributeBase(filters)][level]
}

/** The three descriptive columns for the active family, aliased so the rest of the code is blind to it. */
function attributeColumns(filters: SkuFilters): string {
  const cols = LEVEL_COLUMNS[attributeBase(filters)]
  return `${cols.category} AS category,
          ${cols.subcategory} AS subCategory,
          ${cols.format} AS format`
}

const SHOPEE = 'Shopee'
const TIKTOK = 'Tiktok'

/**
 * The bundle control is the same one the existing Tableau page exposes:
 *   Bundle Dipecah = True  -> BUNDLE_FLAG = FALSE   (components, the SKU as a physical item)
 *   Bundle Dipecah = False -> ITEM_MARKETPLACE_FLAG = TRUE (the listing as sold)
 * They are different populations, not a subset of one another, so the totals differ by design:
 * 81.31B split versus 87.71B unsplit over 1-15 Sep 2026.
 */
function baseScope(filters: SkuFilters, params: Record<string, unknown>): string {
  const split = filters.bundleSplit !== false
  let clause = `REGION_CODE = 'id' AND ${split ? 'BUNDLE_FLAG = FALSE' : 'ITEM_MARKETPLACE_FLAG = TRUE'}`
  // GWP rows are giveaways: 471 barcodes carrying 0.06B, which would distort every rate.
  if (!filters.includeGwp) clause += ` AND GWP_FLAG = FALSE`
  if (filters.bundleType?.length) {
    params.bundleTypes = filters.bundleType
    clause += ` AND ifNull(BUNDLE_TYPE, '(none)') IN {bundleTypes:Array(String)}`
  }
  if (filters.marketplace?.length) {
    params.marketplaces = filters.marketplace
    clause += ` AND MARKETPLACE_NAME IN {marketplaces:Array(String)}`
  }
  return clause
}

function skuFilterClause(filters: SkuFilters, params: Record<string, unknown>): string {
  const brandClause = buildFilterClause(filters.brand ? { brand: filters.brand } : {}, params)
  return brandClause + buildDetailClause(filters.detail, params)
}

function scopeClause(filters: SkuFilters, params: Record<string, unknown>): string {
  if (!filters.scope?.length || !filters.scopeLevel) return ''
  params.scopes = filters.scope
  return ` AND ifNull(${levelColumn(filters, filters.scopeLevel)}, 'Unknown') IN {scopes:Array(String)}`
}

/**
 * Latest wins for every descriptive field: a barcode that was renamed mid-period (or a PID whose
 * listing title changed) must resolve to one label, not two rows. DATE breaks ties because
 * ETL_BATCH_TIME is only day-precision here.
 */
function latest(column: string, alias: string): string {
  return `argMaxIf(${column}, (ETL_BATCH_TIME, DATE), ${column} IS NOT NULL) AS ${alias}`
}

/** Per-marketplace sums, written once and reused by every grouping. */
function splitColumns(): string {
  return `
    sumIf(GMV, inCurrent AND mp = '${SHOPEE}') AS spGmv,
    sumIf(GMV, inPrev AND mp = '${SHOPEE}') AS spGmvPrev,
    sumIf(ITEMS_SOLD, inCurrent AND mp = '${SHOPEE}') AS spItemsSold,
    sumIf(ATTRIBUTED_ORDERS, inCurrent AND mp = '${SHOPEE}') AS spOrders,
    sumIf(COMMISSION, inCurrent AND mp = '${SHOPEE}') AS spCommission,
    uniqExactIf(AFFILIATE_USERNAME, inCurrent AND mp = '${SHOPEE}') AS spCreators,
    sumIf(GMV, inCurrent AND mp = '${TIKTOK}') AS ttGmv,
    sumIf(GMV, inPrev AND mp = '${TIKTOK}') AS ttGmvPrev,
    sumIf(ITEMS_SOLD, inCurrent AND mp = '${TIKTOK}') AS ttItemsSold,
    sumIf(ATTRIBUTED_ORDERS, inCurrent AND mp = '${TIKTOK}') AS ttOrders,
    sumIf(COMMISSION, inCurrent AND mp = '${TIKTOK}') AS ttCommission,
    uniqExactIf(AFFILIATE_USERNAME, inCurrent AND mp = '${TIKTOK}') AS ttCreators,
    sumIf(GMV, inCurrent) AS gmv,
    sumIf(GMV, inPrev) AS gmvPrev,
    sumIf(ITEMS_SOLD, inCurrent) AS itemsSold,
    sumIf(ATTRIBUTED_ORDERS, inCurrent) AS orders,
    sumIf(COMMISSION, inCurrent) AS commission,
    uniqExactIf(AFFILIATE_USERNAME, inCurrent) AS creators`
}

const NUMERIC_KEYS = [
  'spGmv', 'spGmvPrev', 'spItemsSold', 'spOrders', 'spCommission', 'spCreators',
  'ttGmv', 'ttGmvPrev', 'ttItemsSold', 'ttOrders', 'ttCommission', 'ttCreators',
  'gmv', 'gmvPrev', 'itemsSold', 'orders', 'commission', 'creators',
] as const

/** Sums only the known measures; barcode strings and name fields are left alone. */
function foldSplits(group: RawSplit[]): RawSplit {
  const out: Record<string, number> = {}
  for (const g of group) {
    for (const k of NUMERIC_KEYS) {
      out[k] = (out[k] ?? 0) + Number((g as Record<string, unknown>)[k] ?? 0)
    }
  }
  return out as RawSplit
}

interface RawSplit {
  spGmv?: number
  spGmvPrev?: number
  spItemsSold?: number
  spOrders?: number
  spCommission?: number
  spCreators?: number
  ttGmv?: number
  ttGmvPrev?: number
  ttItemsSold?: number
  ttOrders?: number
  ttCommission?: number
  ttCreators?: number
  gmv?: number
  gmvPrev?: number
  itemsSold?: number
  orders?: number
  commission?: number
  creators?: number
}

function toSplit(raw: RawSplit, side: 'sp' | 'tt'): MarketplaceSplit {
  const pick = (k: string) => Number((raw as Record<string, number | undefined>)[`${side}${k}`] ?? 0)
  return {
    gmv: pick('Gmv'),
    gmvPrev: pick('GmvPrev'),
    itemsSold: pick('ItemsSold'),
    orders: pick('Orders'),
    commission: pick('Commission'),
    creators: pick('Creators'),
  }
}

function toTotals(raw: RawSplit, totalGmv: number): SkuTotals {
  const gmv = Number(raw.gmv ?? 0)
  const gmvPrev = Number(raw.gmvPrev ?? 0)
  const orders = Number(raw.orders ?? 0)
  const shopee = toSplit(raw, 'sp')
  const tiktok = toSplit(raw, 'tt')

  return {
    gmv,
    gmvPrev,
    deltaRp: gmv - gmvPrev,
    growth: pctDelta(gmv, gmvPrev),
    share: totalGmv > 0 ? gmv / totalGmv : 0,
    itemsSold: Number(raw.itemsSold ?? 0),
    orders,
    commission: Number(raw.commission ?? 0),
    creators: Number(raw.creators ?? 0),
    // Rate metrics recomputed from totals, never summed (CLAUDE.md).
    aov: ratio(gmv, orders),
    shopeeShare: ratio(shopee.gmv, gmv),
    shopee,
    tiktok,
  }
}

export async function getSkuCategories(
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: SkuFilters,
  level: SkuLevel,
  prevRange?: { from?: string; to?: string },
): Promise<SkuCategoriesResult> {
  const column = levelColumn(filters, level)
  const comparison = computeComparisonRange(from, to, basis, prevRange)
  const params: Record<string, unknown> = {
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const scope = baseScope(filters, params)
  const filterClause = skuFilterClause(filters, params)

  // Two groupings: the measures (including a correct distinct-creator count) per category, and
  // a barcode-level pass used only to count SKUs and how many sell on both marketplaces.
  // uniqExact cannot be summed, so the creator column has to be grouped at the level it is shown.
  const result = await clickhouse.query({
    query: `
      SELECT name, ${splitColumns()}
      FROM (${currentAndPrevRows(column, scope, filterClause)})
      GROUP BY name
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const skuResult = await clickhouse.query({
    query: `
      SELECT name, barcode, sumIf(GMV, inCurrent AND mp = '${SHOPEE}') AS spGmv,
             sumIf(GMV, inCurrent AND mp = '${TIKTOK}') AS ttGmv,
             sumIf(GMV, inCurrent) AS gmv, sumIf(GMV, inPrev) AS gmvPrev
      FROM (${currentAndPrevRows(column, scope, filterClause)})
      GROUP BY name, barcode
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const rawRows = await result.json<RawSplit & { name: string }>()
  const skuRows = await skuResult.json<{
    name: string
    barcode: string
    spGmv: number
    ttGmv: number
    gmv: number
    gmvPrev: number
  }>()

  const isCross = (r: { spGmv?: number; ttGmv?: number }) =>
    Number(r.spGmv ?? 0) > 0 && Number(r.ttGmv ?? 0) > 0

  const skusByName = new Map<string, typeof skuRows>()
  for (const r of skuRows) {
    if (!skusByName.has(r.name)) skusByName.set(r.name, [])
    skusByName.get(r.name)?.push(r)
  }

  const totalGmv = rawRows.reduce((acc, r) => acc + Number(r.gmv ?? 0), 0)

  const rows: SkuCategoryRow[] = rawRows
    .map((r) => {
      const group = skusByName.get(r.name) ?? []
      return {
        name: r.name,
        skus: group.filter((g) => Number(g.gmv || 0) !== 0 || Number(g.gmvPrev || 0) !== 0).length,
        crossMarketplaceSkus: group.filter(isCross).length,
        ...toTotals(r, totalGmv),
      }
    })
    .sort((a, b) => b.gmv - a.gmv)

  const total: SkuCategoryRow = {
    name: 'SKU TOTAL',
    skus: new Set(skuRows.map((r) => r.barcode)).size,
    crossMarketplaceSkus: skuRows.filter(isCross).length,
    ...toTotals(foldSplits(rawRows), totalGmv),
    share: 1,
  }
  // Distinct people again — the folded sum would count anyone selling in two categories twice.
  await applyCreatorCounts(total, scope, filterClause, params)

  return {
    level,
    attributeBase: attributeBase(filters),
    total,
    rows,
    current: { from, to },
    comparison: { ...comparison, basis },
  }
}

/** The row source shared by the category query and its barcode-level companion. */
function currentAndPrevRows(column: string, scope: string, filterClause: string): string {
  return `
        SELECT
          ifNull(${column}, 'Unknown') AS name,
          ifNull(BARCODE, '(none)') AS barcode,
          MARKETPLACE_NAME AS mp,
          GMV,
          ITEMS_SOLD,
          ATTRIBUTED_ORDERS,
          COMMISSION,
          AFFILIATE_USERNAME,
          (DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS inCurrent,
          (DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS inPrev
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${scope}
          AND IS_AFFILIATE = TRUE
          ${TWO_WINDOW_CLAUSE}
          ${filterClause}`
}

/**
 * Overwrites the creator counts on an already-folded total. Distinct-creator counts cannot be
 * summed across groups, so they are re-queried at the level actually being displayed.
 */
async function applyCreatorCounts(
  target: SkuTotals,
  scope: string,
  filterClause: string,
  params: Record<string, unknown>,
): Promise<void> {
  const result = await clickhouse.query({
    query: `
      SELECT
        uniqExact(AFFILIATE_USERNAME) AS creators,
        uniqExactIf(AFFILIATE_USERNAME, MARKETPLACE_NAME = '${SHOPEE}') AS spCreators,
        uniqExactIf(AFFILIATE_USERNAME, MARKETPLACE_NAME = '${TIKTOK}') AS ttCreators
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${scope}
        AND IS_AFFILIATE = TRUE
        AND DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}
        ${filterClause}
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const row = (await result.json<{ creators: number; spCreators: number; ttCreators: number }>())[0]
  if (!row) return
  target.creators = Number(row.creators || 0)
  target.shopee.creators = Number(row.spCreators || 0)
  target.tiktok.creators = Number(row.ttCreators || 0)
}

export async function getSkuProducts(
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: SkuFilters,
  prevRange?: { from?: string; to?: string },
): Promise<SkuProductsResult> {
  const comparison = computeComparisonRange(from, to, basis, prevRange)
  const params: Record<string, unknown> = {
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const scope = baseScope(filters, params)
  const filterClause = skuFilterClause(filters, params)

  const result = await clickhouse.query({
    query: `
      SELECT
        barcode,
        uniqExactIf(pid, inCurrent) AS pidCount,
        ${splitColumns()}
      FROM (
        SELECT
          ifNull(BARCODE, '(none)') AS barcode,
          PRODUCT_ID AS pid,
          MARKETPLACE_NAME AS mp,
          GMV,
          ITEMS_SOLD,
          ATTRIBUTED_ORDERS,
          COMMISSION,
          AFFILIATE_USERNAME,
          (DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS inCurrent,
          (DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS inPrev
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${scope}
          AND IS_AFFILIATE = TRUE
          ${TWO_WINDOW_CLAUSE}
          ${filterClause}
      )
      GROUP BY barcode
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  type RawSkuRow = RawSplit & { barcode: string; pidCount: number }

  const rawRows = await result.json<RawSkuRow>()
  // Every descriptive field is static per barcode, so none of them belong in the hot path.
  const { names, extra } = await getNames({
    key: `sku-name-${filters.bundleSplit === false ? 'listing' : 'split'}-${attributeBase(filters)}`,
    idColumn: `ifNull(BARCODE, '(none)')`,
    scope: baseScope(filters, {}),
    nameColumn: 'VARIANT_SAP_NAME',
    extraColumns: {
      variantName: 'VARIANT_NAME',
      productName: 'PRODUCT_NAME',
      category: LEVEL_COLUMNS[attributeBase(filters)].category,
      subCategory: LEVEL_COLUMNS[attributeBase(filters)].subcategory,
      format: LEVEL_COLUMNS[attributeBase(filters)].format,
    },
  })
  const totalGmv = rawRows.reduce((acc, r) => acc + Number(r.gmv ?? 0), 0)
  const scopeKey = filters.scopeLevel ?? 'category'

  const rows: SkuRow[] = rawRows
    .map((r) => {
      const d = extra.get(r.barcode) ?? {}
      const category = d.category ?? 'Unknown'
      const subCategory = d.subCategory ?? 'Unknown'
      const format = d.format ?? 'Unknown'
      const levelValue = scopeKey === 'category' ? category : scopeKey === 'subcategory' ? subCategory : format
      const totals = toTotals(r, totalGmv)

      return {
        barcode: r.barcode,
        ...composeName(names.get(r.barcode) ?? null, d.variantName ?? null, d.productName ?? null),
        variantName: d.variantName ?? '',
        productName: d.productName ?? '',
        category,
        subCategory,
        format,
        pidCount: Number(r.pidCount || 0),
        inScope: !filters.scope?.length || filters.scope.includes(levelValue),
        crossMarketplace: totals.shopee.gmv > 0 && totals.tiktok.gmv > 0,
        ...totals,
      }
    })
    .sort((a, b) => b.gmv - a.gmv)

  const inScope = rows.filter((r) => r.inScope)

  return {
    rows,
    scope: filters.scope?.join(', ') ?? null,
    countSku: inScope.length,
    countCrossMarketplace: inScope.filter((r) => r.crossMarketplace).length,
    countShopeeOnly: inScope.filter((r) => r.shopee.gmv > 0 && r.tiktok.gmv === 0).length,
    countTiktokOnly: inScope.filter((r) => r.tiktok.gmv > 0 && r.shopee.gmv === 0).length,
  }
}

/**
 * 4,267 of 9,603 barcodes carry no VARIANT_SAP_NAME; every one inspected was a paket/bundle
 * listing whose VARIANT_NAME alone is meaningless ("32 N + 32 N"), so those fall back to the
 * variant label qualified by the listing title, and are flagged so the UI can say so.
 */
function composeName(
  sapName: string | null,
  variantName: string | null,
  productName: string | null,
): { name: string; isPaket: boolean } {
  if (sapName) return { name: sapName, isPaket: false }
  const variant = variantName?.trim()
  const product = productName?.trim()
  if (variant && product) return { name: `${variant} · ${product}`, isPaket: true }
  return { name: variant || product || '(tanpa nama)', isPaket: true }
}

export async function getSkuTrend(
  from: string,
  to: string,
  filters: SkuFilters,
  granularity: TrendGranularity,
): Promise<SkuTrendPoint[]> {
  const params: Record<string, unknown> = { from, to }
  const scope = baseScope(filters, params)
  const filterClause = skuFilterClause(filters, params)
  const scopeSql = scopeClause(filters, params)
  const bucket = bucketExpression(granularity)

  const result = await clickhouse.query({
    query: `
      SELECT
        ${bucket} AS bucket,${TREND_METRICS_SQL},
        sumIf(GMV, MARKETPLACE_NAME = '${SHOPEE}') AS shopee,
        sumIf(GMV, MARKETPLACE_NAME = '${TIKTOK}') AS tiktok
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${scope}
        AND IS_AFFILIATE = TRUE
        AND DATE >= {from:Date} AND DATE <= {to:Date}
        ${filterClause}${scopeSql}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const rows = await result.json<Record<string, unknown> & { bucket: string; shopee: number; tiktok: number }>()
  return rows.map((r) => ({
    bucket: r.bucket,
    ...toTrendMetrics(r),
    shopee: Number(r.shopee || 0),
    tiktok: Number(r.tiktok || 0),
  }))
}

export async function getSkuDetail(
  barcodes: string[],
  from: string,
  to: string,
  basis: ComparisonBasis,
  filters: SkuFilters,
  granularity: TrendGranularity,
  prevRange?: { from?: string; to?: string },
): Promise<SkuDetail | null> {
  const comparison = computeComparisonRange(from, to, basis, prevRange)
  const params: Record<string, unknown> = {
    barcodes,
    currentFrom: from,
    currentTo: to,
    prevFrom: comparison.from,
    prevTo: comparison.to,
  }
  const scope = baseScope(filters, params)
  const filterClause = skuFilterClause(filters, params)
  const barcodeFilter = ` AND ifNull(BARCODE, '(none)') IN {barcodes:Array(String)}`

  const infoResult = await clickhouse.query({
    query: `
      SELECT
        barcode,
        ${latest('sapName', 'sapName')},
        ${latest('variantName', 'variantName')},
        ${latest('productName', 'productName')},
        ${latest('category', 'category')},
        ${latest('subCategory', 'subCategory')},
        ${latest('format', 'format')},
        uniqExactIf(pid, inCurrent) AS pidCount,
        ${splitColumns()}
      FROM (
        SELECT
          ifNull(BARCODE, '(none)') AS barcode,
          VARIANT_SAP_NAME AS sapName,
          VARIANT_NAME AS variantName,
          PRODUCT_NAME AS productName,
          ${attributeColumns(filters)},
          PRODUCT_ID AS pid,
          MARKETPLACE_NAME AS mp,
          GMV,
          ITEMS_SOLD,
          ATTRIBUTED_ORDERS,
          COMMISSION,
          AFFILIATE_USERNAME,
          ETL_BATCH_TIME,
          DATE,
          (DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}) AS inCurrent,
          (DATE >= {prevFrom:Date} AND DATE <= {prevTo:Date}) AS inPrev
        FROM ${TABLE_SUMMARY_ORDER}
        WHERE ${scope}
          AND IS_AFFILIATE = TRUE
          ${TWO_WINDOW_CLAUSE}
          ${filterClause}${barcodeFilter}
      )
      GROUP BY barcode
      ORDER BY gmv DESC
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const infoRows = await infoResult.json<
    RawSplit & {
      barcode: string
      sapName: string | null
      variantName: string | null
      productName: string | null
      category: string | null
      subCategory: string | null
      format: string | null
    }
  >()
  if (infoRows.length === 0) return null

  const folded = foldSplits(infoRows)
  const totals = toTotals(folded, Number(folded.gmv ?? 0))
  // Counted across the whole selection so one person selling two of the picked SKUs still
  // counts once — summing the per-barcode uniqExact would double count them.
  await applyCreatorCounts(totals, scope + barcodeFilter, filterClause, params)

  const shared = (values: string[]): string => {
    const unique = [...new Set(values)]
    return unique.length === 1 ? (unique[0] as string) : 'Beragam'
  }
  const first = infoRows[0]
  const composed = composeName(first?.sapName ?? null, first?.variantName ?? null, first?.productName ?? null)
  const members = infoRows.map((r) => ({
    barcode: r.barcode,
    name: composeName(r.sapName, r.variantName, r.productName).name,
    gmv: Number(r.gmv ?? 0),
  }))

  const pidResult = await clickhouse.query({
    query: `
      SELECT
        PRODUCT_ID AS pid,
        MARKETPLACE_NAME AS marketplace,
        ${latest('PRODUCT_NAME', 'productName')},
        SUM(GMV) AS gmv
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${scope}
        AND IS_AFFILIATE = TRUE
        AND DATE >= {currentFrom:Date} AND DATE <= {currentTo:Date}
        ${filterClause}${barcodeFilter}
      GROUP BY pid, marketplace
      ORDER BY gmv DESC
      LIMIT 25
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const pidRows = await pidResult.json<{
    pid: string
    marketplace: string
    productName: string | null
    gmv: number
  }>()
  const pidTotal = pidRows.reduce((acc, p) => acc + Number(p.gmv || 0), 0)
  const pids: SkuPidContribution[] = pidRows.map((p) => ({
    pid: p.pid,
    productName: p.productName ?? '',
    marketplace: p.marketplace,
    gmv: Number(p.gmv || 0),
    share: pidTotal > 0 ? Number(p.gmv || 0) / pidTotal : 0,
  }))

  const trend = await getSkuTrendForBarcodes(barcodes, from, to, filters, granularity)

  return {
    barcodes: members.map((m) => m.barcode),
    name: members.length === 1 ? composed.name : `${members.length} SKU digabung`,
    members,
    isPaket: composed.isPaket,
    category: shared(infoRows.map((r) => r.category ?? 'Unknown')),
    subCategory: shared(infoRows.map((r) => r.subCategory ?? 'Unknown')),
    format: shared(infoRows.map((r) => r.format ?? 'Unknown')),
    totals,
    trend,
    pids,
  }
}

async function getSkuTrendForBarcodes(
  barcodes: string[],
  from: string,
  to: string,
  filters: SkuFilters,
  granularity: TrendGranularity,
): Promise<SkuTrendPoint[]> {
  const params: Record<string, unknown> = { barcodes, from, to }
  const scope = baseScope(filters, params)
  const filterClause = skuFilterClause(filters, params)
  const bucket = bucketExpression(granularity)

  const result = await clickhouse.query({
    query: `
      SELECT
        ${bucket} AS bucket,${TREND_METRICS_SQL},
        sumIf(GMV, MARKETPLACE_NAME = '${SHOPEE}') AS shopee,
        sumIf(GMV, MARKETPLACE_NAME = '${TIKTOK}') AS tiktok
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${scope}
        AND IS_AFFILIATE = TRUE
        AND ifNull(BARCODE, '(none)') IN {barcodes:Array(String)}
        AND DATE >= {from:Date} AND DATE <= {to:Date}
        ${filterClause}
      GROUP BY bucket
      ORDER BY bucket ASC
    `,
    query_params: params,
    format: 'JSONEachRow',
  })

  const rows = await result.json<Record<string, unknown> & { bucket: string; shopee: number; tiktok: number }>()
  return rows.map((r) => ({
    bucket: r.bucket,
    ...toTrendMetrics(r),
    shopee: Number(r.shopee || 0),
    tiktok: Number(r.tiktok || 0),
  }))
}

export async function getSkuTopCreators(
  from: string,
  to: string,
  filters: SkuFilters,
  managed: boolean | null,
  limit: number,
): Promise<SkuCreatorsResult> {
  const params: Record<string, unknown> = { from, to }
  const scope = baseScope(filters, params)
  const filterClause = skuFilterClause(filters, params)
  const scopeSql = scopeClause(filters, params)

  let extra = ''
  if (managed !== null) {
    params.managed = managed ? 1 : 0
    extra += ` AND IS_MANAGED_CREATOR = {managed:UInt8}`
  }

  const result = await clickhouse.query({
    query: `
      SELECT
        AFFILIATE_USERNAME AS username,
        MAX(IS_MANAGED_CREATOR) AS isManaged,
        arrayStringConcat(arraySort(groupUniqArray(MARKETPLACE_NAME)), ' + ') AS marketplaces,
        SUM(GMV) AS gmv,
        SUM(ATTRIBUTED_ORDERS) AS orders,
        SUM(ITEMS_SOLD) AS itemsSold,
        SUM(COMMISSION) AS commission
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${scope}
        AND IS_AFFILIATE = TRUE
        AND AFFILIATE_USERNAME IS NOT NULL
        AND DATE >= {from:Date} AND DATE <= {to:Date}
        ${filterClause}${scopeSql}${extra}
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
    marketplaces: string
    gmv: number
    orders: number
    itemsSold: number
    commission: number
  }>()

  const totalResult = await clickhouse.query({
    query: `
      SELECT SUM(GMV) AS gmv
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE ${scope}
        AND IS_AFFILIATE = TRUE
        AND DATE >= {from:Date} AND DATE <= {to:Date}
        ${filterClause}${scopeSql}${extra}
    `,
    query_params: params,
    format: 'JSONEachRow',
  })
  const totalGmv = Number((await totalResult.json<{ gmv: number }>())[0]?.gmv ?? 0)

  const rows: SkuCreatorRow[] = raw.map((r) => {
    const gmv = Number(r.gmv || 0)
    const orders = Number(r.orders || 0)
    return {
      username: r.username,
      isManaged: Boolean(r.isManaged),
      marketplaces: r.marketplaces,
      gmv,
      share: totalGmv > 0 ? gmv / totalGmv : 0,
      orders,
      itemsSold: Number(r.itemsSold || 0),
      commission: Number(r.commission || 0),
      aov: orders > 0 ? gmv / orders : 0,
    }
  })

  const top10 = rows.slice(0, 10).reduce((acc, r) => acc + r.gmv, 0)

  return { rows, totalGmv, concentrationTop10: totalGmv > 0 ? top10 / totalGmv : 0 }
}

export async function getSkuFilterOptions(from: string, to: string): Promise<SkuFilterOptionsResult> {
  const result = await clickhouse.query({
    query: `
      SELECT
        arraySort(groupUniqArray(ifNull(BUNDLE_TYPE, '(none)'))) AS bundleTypes,
        arraySort(groupUniqArray(MARKETPLACE_NAME)) AS marketplaces
      FROM ${TABLE_SUMMARY_ORDER}
      WHERE REGION_CODE = 'id' AND DATE >= {from:Date} AND DATE <= {to:Date}
    `,
    query_params: { from, to },
    format: 'JSONEachRow',
  })
  const row = (await result.json<{ bundleTypes: string[]; marketplaces: string[] }>())[0]
  return {
    bundleTypes: row?.bundleTypes ?? [],
    marketplaces: (row?.marketplaces ?? []).filter(Boolean),
  }
}

/** Same idea one grain finer: creators selling other SKUs in the sub-category, never this one. */
export async function getSkuOpportunityCreators(
  barcodes: string[],
  from: string,
  to: string,
  filters: SkuFilters,
  limit: number,
  pillar?: string,
  level: SimilarityLevel = 'subcategory',
): Promise<OpportunityCreatorsResult> {
  const params: Record<string, unknown> = {}
  const scope = baseScope(filters, params)
  return findOpportunityCreators({
    scope,
    idColumn: `ifNull(BARCODE, '(none)')`,
    // Follows whichever attribute family the SKU page is grouping by.
    similarityColumn: similarityColumn(filters.attributeBase === 'pid' ? 'PID' : 'PRODUCT', level),
    filterClause: skuFilterClause(filters, params),
    ids: barcodes,
    from,
    to,
    limit,
    pillar,
    params,
  })
}

export async function getSkuCreatorDetail(
  username: string,
  from: string,
  to: string,
  filters: SkuFilters,
  granularity: TrendGranularity,
): Promise<CreatorDetail> {
  const params: Record<string, unknown> = {}
  const scope = baseScope(filters, params)
  return getCreatorDetail({
    username,
    scope,
    filterClause: skuFilterClause(filters, params),
    idColumn: `ifNull(BARCODE, '(none)')`,
    nameCacheKey: `sku-name-${filters.bundleSplit === false ? 'listing' : 'split'}`,
    nameColumn: 'VARIANT_SAP_NAME',
    from,
    to,
    granularity,
    params,
  })
}
