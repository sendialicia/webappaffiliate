import type { SimilarityLevel } from '../services/opportunity.service'
import type { Request, Response } from 'express'
import {
  getSkuCategories,
  getSkuCreatorDetail,
  getSkuOpportunityCreators,
  getSkuDetail,
  getSkuFilterOptions,
  getSkuProducts,
  getSkuTopCreators,
  getSkuTrend,
} from '../services/sku.service'
import type { ComparisonBasis, DetailFilters, TrendGranularity } from '../types/overview'
import type { SkuAttributeBase, SkuFilters, SkuLevel } from '../types/sku'

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/** Filters arrive comma separated; a single value still works unchanged. */
function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => list(v))
  return (str(value) ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
}

function defaultFrom(to: string): string {
  const d = new Date(to)
  d.setDate(d.getDate() - 29)
  return d.toISOString().slice(0, 10)
}

function range(req: Request): { from: string; to: string } {
  const to = str(req.query.to) ?? new Date().toISOString().slice(0, 10)
  return { from: str(req.query.from) ?? defaultFrom(to), to }
}

function basisOf(req: Request): ComparisonBasis {
  if (req.query.compare === 'ly') return 'ly'
  if (req.query.compare === 'custom') return 'custom'
  return 'prev'
}

/** Explicit previous window, honoured only when compare=custom. */
function prevRangeOf(req: Request): { from?: string; to?: string } {
  const from = str(req.query.prevFrom)
  const to = str(req.query.prevTo)
  return { ...(from ? { from } : {}), ...(to ? { to } : {}) }
}

function granularityOf(req: Request): TrendGranularity {
  return req.query.granularity === 'week' || req.query.granularity === 'month'
    ? req.query.granularity
    : 'day'
}

/** PRODUCT_* unless the page explicitly asks for the PID classification. */
function baseOf(value: unknown): SkuAttributeBase {
  return value === 'pid' ? 'pid' : 'product'
}

function levelOf(value: unknown): SkuLevel {
  return value === 'subcategory' || value === 'format' ? value : 'category'
}

/** SKU dimensions plus the PID ones — the Tableau page offers both sets. */
const DETAIL_KEYS = [
  'pillar',
  'pidCategory',
  'pidSubCategory',
  'pidFormat',
  'productCategory',
  'productSubCategory',
  'productFormat',
] as const

function detailOf(req: Request): DetailFilters {
  const detail: DetailFilters = {}
  for (const key of DETAIL_KEYS) {
    const values = list(req.query[key])
    if (values.length > 0) detail[key] = values
  }
  return detail
}

function filtersOf(req: Request): SkuFilters {
  const filters: SkuFilters = { attributeBase: baseOf(req.query.attributeBase) }
  const brand = list(req.query.brand)
  const scope = list(req.query.scope)
  const bundleType = list(req.query.bundleType)
  const marketplace = list(req.query.marketplace)
  const detail = detailOf(req)

  if (brand.length > 0) filters.brand = brand
  if (scope.length > 0) {
    filters.scope = scope
    filters.scopeLevel = levelOf(str(req.query.level))
  }
  if (bundleType.length > 0) filters.bundleType = bundleType
  if (marketplace.length > 0) filters.marketplace = marketplace
  if (Object.keys(detail).length > 0) filters.detail = detail
  // Both default the way the existing Tableau page does: bundles split, GWP excluded.
  filters.bundleSplit = req.query.bundleSplit !== 'false'
  filters.includeGwp = req.query.includeGwp === 'true'
  return filters
}

/** Which attribute tier counts as "comparable" for the opportunity list; sub-category by default. */
function oppLevelOf(value: unknown): SimilarityLevel {
  return value === 'category' || value === 'format' ? value : 'subcategory'
}

export async function getSkuCategoriesHandler(req: Request, res: Response) {
  const { from, to } = range(req)
  const level = levelOf(str(req.query.level))
  const data = await getSkuCategories(from, to, basisOf(req), filtersOf(req), level, prevRangeOf(req))
  res.json(data)
}

export async function getSkuProductsHandler(req: Request, res: Response) {
  const { from, to } = range(req)
  const data = await getSkuProducts(from, to, basisOf(req), filtersOf(req), prevRangeOf(req))
  res.json(data)
}

export async function getSkuTrendHandler(req: Request, res: Response) {
  const { from, to } = range(req)
  const data = await getSkuTrend(from, to, filtersOf(req), granularityOf(req))
  res.json(data)
}

export async function getSkuDetailHandler(req: Request, res: Response) {
  // One or several SKUs, comma separated; several are reported as one combined detail.
  const barcodes = list(req.query.barcode)
  if (barcodes.length === 0) {
    res.status(400).json({ error: 'barcode is required' })
    return
  }

  const { from, to } = range(req)
  const data = await getSkuDetail(
    barcodes,
    from,
    to,
    basisOf(req),
    filtersOf(req),
    granularityOf(req),
    prevRangeOf(req),
  )
  if (!data) {
    res.status(404).json({ error: 'sku not found in this period' })
    return
  }
  res.json(data)
}

export async function getSkuTopCreatorsHandler(req: Request, res: Response) {
  const { from, to } = range(req)
  const managedParam = str(req.query.managed)
  const managed = managedParam === 'true' ? true : managedParam === 'false' ? false : null
  const limit = Number(str(req.query.limit)) || 25
  // With SKUs picked in the table the list answers "who sells these"; otherwise the scope.
  const barcodes = list(req.query.barcode)

  const data = await getSkuTopCreators(from, to, filtersOf(req), managed, limit, barcodes)
  res.json(data)
}

export async function getSkuFilterOptionsHandler(req: Request, res: Response) {
  const { from, to } = range(req)
  res.json(await getSkuFilterOptions(from, to))
}

export async function getSkuOpportunityCreatorsHandler(req: Request, res: Response) {
  const barcodes = list(req.query.barcode)
  if (barcodes.length === 0) {
    res.status(400).json({ error: 'barcode is required' })
    return
  }
  const { from, to } = range(req)
  const limit = Number(str(req.query.limit)) || 20
  res.json(await getSkuOpportunityCreators(barcodes, from, to, filtersOf(req), limit, str(req.query.oppPillar), oppLevelOf(req.query.oppLevel)))
}

export async function getSkuCreatorDetailHandler(req: Request, res: Response) {
  const username = str(req.query.username)
  if (!username) {
    res.status(400).json({ error: 'username is required' })
    return
  }
  const { from, to } = range(req)
  res.json(await getSkuCreatorDetail(username, from, to, filtersOf(req), granularityOf(req)))
}
