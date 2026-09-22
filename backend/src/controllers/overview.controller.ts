import type { Request, Response } from 'express'
import {
  getComposition,
  getDailyPerformance,
  getDrivers,
  getFunnel,
  getMonthlyPerformance,
  getProgress,
  getFilterOptions,
  getDataAvailability,
  getDriverMatrix,
  getTopCreators,
  getFindingsInputs,
  getCreatorDrivers,
  getSpend,
  getSummary,
} from '../services/overview.service'
import type {
  ComparisonBasis,
  CompositionDimension,
  DetailFilters,
  DriverField,
  DriverEntity,
  OverviewFilters,
  TrendGranularity,
} from '../types/overview'

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

const DRIVER_FIELDS: DriverField[] = [
  'brand',
  'marketplace',
  'pillar',
  'pidCategory',
  'pidSubCategory',
  'pidFormat',
  'subpillar',
  'productCategory',
  'productSubCategory',
  'productFormat',
]

function driverFieldOf(value: unknown, fallback: DriverField): DriverField {
  return DRIVER_FIELDS.find((f) => f === value) ?? fallback
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const DETAIL_KEYS: Array<keyof DetailFilters> = [
  'pillar',
  'subpillar',
  'pidCategory',
  'pidSubCategory',
  'pidFormat',
  'productCategory',
  'productSubCategory',
  'productFormat',
]

function detailFromQuery(req: Request): DetailFilters {
  const detail: DetailFilters = {}
  for (const key of DETAIL_KEYS) {
    const values = list(req.query[key])
    if (values.length > 0) detail[key] = values
  }
  return detail
}

function prevRangeFromQuery(req: Request): { from?: string; to?: string } {
  const range: { from?: string; to?: string } = {}
  const prevFrom = str(req.query.prevFrom)
  const prevTo = str(req.query.prevTo)
  if (prevFrom) range.from = prevFrom
  if (prevTo) range.to = prevTo
  return range
}

function basisFromQuery(req: Request): ComparisonBasis {
  if (req.query.compare === 'ly') return 'ly'
  if (req.query.compare === 'custom') return 'custom'
  return 'prev'
}

function filtersFromQuery(req: Request): OverviewFilters {
  const filters: OverviewFilters = {}
  const brand = list(req.query.brand)
  const marketplace = list(req.query.marketplace)
  if (brand.length > 0) filters.brand = brand
  if (marketplace.length > 0) filters.marketplace = marketplace
  return filters
}

export async function getMonthlyPerformanceHandler(req: Request, res: Response) {
  const year = Number(str(req.query.year)) || new Date().getFullYear()
  const data = await getMonthlyPerformance(year, filtersFromQuery(req))
  res.json(data)
}

export async function getDailyPerformanceHandler(req: Request, res: Response) {
  const month = str(req.query.month) ?? currentMonth()
  const data = await getDailyPerformance(month, filtersFromQuery(req))
  res.json(data)
}

export async function getProgressHandler(req: Request, res: Response) {
  const month = str(req.query.month) ?? currentMonth()
  const data = await getProgress(month, filtersFromQuery(req))
  res.json(data)
}

export async function getSummaryHandler(req: Request, res: Response) {
  const to = str(req.query.to) ?? new Date().toISOString().slice(0, 10)
  const from = str(req.query.from) ?? defaultFrom(to)
  const basis: ComparisonBasis = basisFromQuery(req)
  const granularity: TrendGranularity =
    req.query.granularity === 'week' || req.query.granularity === 'month' ? req.query.granularity : 'day'

  const data = await getSummary(from, to, basis, filtersFromQuery(req), granularity, detailFromQuery(req), prevRangeFromQuery(req))
  res.json(data)
}

export async function getCompositionHandler(req: Request, res: Response) {
  const to = str(req.query.to) ?? new Date().toISOString().slice(0, 10)
  const from = str(req.query.from) ?? defaultFrom(to)
  const basis: ComparisonBasis = basisFromQuery(req)
  const granularity: TrendGranularity =
    req.query.granularity === 'week' || req.query.granularity === 'month' ? req.query.granularity : 'day'
  const dimensionParam = str(req.query.dimension)
  const COMPOSITION_DIMENSIONS = [
    'pillar',
    'subpillar',
    'brand',
    'marketplace',
    'category',
    'pidSubCategory',
    'format',
    'productCategory',
    'productSubCategory',
    'productFormat',
  ] as const
  const dimension: CompositionDimension = (COMPOSITION_DIMENSIONS as readonly string[]).includes(
    dimensionParam ?? '',
  )
    ? (dimensionParam as CompositionDimension)
    : 'pillar'
  // Every value by default: the waterfall and table scroll, so even the ~61 formats fit, and a
  // cut list would leave the bridge short of the total. The cap only guards a runaway column.
  const limit = Math.min(Number(str(req.query.limit)) || 500, 500)

  const data = await getComposition(from, to, basis, filtersFromQuery(req), granularity, dimension, limit, detailFromQuery(req), prevRangeFromQuery(req))
  res.json(data)
}

export async function getDriversHandler(req: Request, res: Response) {
  const to = str(req.query.to) ?? new Date().toISOString().slice(0, 10)
  const from = str(req.query.from) ?? defaultFrom(to)
  const basis: ComparisonBasis = basisFromQuery(req)
  const entity = driverFieldOf(req.query.entity, 'brand')
  const dimension = driverFieldOf(req.query.dimension, 'pidFormat')
  // Top 20 plus a folded "Lainnya" — ~94% of GMV by name; more colours than that start repeating.
  const limit = Math.min(Number(str(req.query.limit)) || 20, 20)

  const data = await getDrivers(from, to, basis, filtersFromQuery(req), entity, dimension, limit, detailFromQuery(req), prevRangeFromQuery(req))
  res.json(data)
}

export async function getSpendHandler(req: Request, res: Response) {
  const to = str(req.query.to) ?? new Date().toISOString().slice(0, 10)
  const from = str(req.query.from) ?? defaultFrom(to)
  const basis: ComparisonBasis = basisFromQuery(req)
  const granularity: TrendGranularity =
    req.query.granularity === 'week' || req.query.granularity === 'month' ? req.query.granularity : 'day'
  const entity: DriverEntity = req.query.entity === 'marketplace' ? 'marketplace' : 'brand'

  const data = await getSpend(from, to, basis, filtersFromQuery(req), granularity, entity, detailFromQuery(req), prevRangeFromQuery(req))
  res.json(data)
}

export async function getFunnelHandler(req: Request, res: Response) {
  const to = str(req.query.to) ?? new Date().toISOString().slice(0, 10)
  const from = str(req.query.from) ?? defaultFrom(to)
  const basis: ComparisonBasis = basisFromQuery(req)

  const data = await getFunnel(from, to, basis, filtersFromQuery(req), prevRangeFromQuery(req))
  res.json(data)
}

export async function getFilterOptionsHandler(req: Request, res: Response) {
  const to = str(req.query.to) ?? new Date().toISOString().slice(0, 10)
  const from = str(req.query.from) ?? defaultFrom(to)
  const data = await getFilterOptions(from, to, filtersFromQuery(req))
  res.json(data)
}

function defaultFrom(to: string): string {
  const d = new Date(to)
  d.setDate(d.getDate() - 29)
  return d.toISOString().slice(0, 10)
}

export async function getDataAvailabilityHandler(_req: Request, res: Response) {
  res.json(await getDataAvailability())
}

export async function getDriverMatrixHandler(req: Request, res: Response) {
  const to = str(req.query.to) ?? new Date().toISOString().slice(0, 10)
  const from = str(req.query.from) ?? defaultFrom(to)
  const basis: ComparisonBasis = basisFromQuery(req)
  const entity = driverFieldOf(req.query.entity, 'brand')
  const dimension = driverFieldOf(req.query.dimension, 'pidFormat')
  // Top 20 columns plus a folded "Lainnya": ~94% of GMV, and still scannable as a grid.
  const limit = Math.min(Number(str(req.query.limit)) || 20, 20)

  const data = await getDriverMatrix(from, to, basis, filtersFromQuery(req), entity, dimension, limit, detailFromQuery(req), prevRangeFromQuery(req))
  res.json(data)
}

export async function getTopCreatorsHandler(req: Request, res: Response) {
  const to = str(req.query.to) ?? new Date().toISOString().slice(0, 10)
  const from = str(req.query.from) ?? defaultFrom(to)
  const basis: ComparisonBasis = basisFromQuery(req)
  const dimension = str(req.query.dimension) as CompositionDimension | undefined
  const value = str(req.query.value)
  const slice = dimension && value !== undefined && COMPOSITION_DIMENSION_KEYS.includes(dimension) ? { dimension, value } : null
  const limit = Math.min(Number(str(req.query.limit)) || 10, 50)
  res.json(await getTopCreators(from, to, basis, filtersFromQuery(req), detailFromQuery(req), slice, limit, prevRangeFromQuery(req)))
}

const COMPOSITION_DIMENSION_KEYS: CompositionDimension[] = [
  'pillar',
  'subpillar',
  'brand',
  'marketplace',
  'category',
  'pidSubCategory',
  'format',
  'productCategory',
  'productSubCategory',
  'productFormat',
]

export async function getFindingsInputsHandler(req: Request, res: Response) {
  const to = str(req.query.to) ?? new Date().toISOString().slice(0, 10)
  const from = str(req.query.from) ?? defaultFrom(to)
  res.json(await getFindingsInputs(from, to, basisFromQuery(req), filtersFromQuery(req), detailFromQuery(req), prevRangeFromQuery(req)))
}

/** Slices arrive as field1/value1, field2/value2 — a composition row, or a matrix cell's two sides. */
export async function getCreatorDriversHandler(req: Request, res: Response) {
  const to = str(req.query.to) ?? new Date().toISOString().slice(0, 10)
  const from = str(req.query.from) ?? defaultFrom(to)
  const slices: Array<{ field: string; value: string }> = []
  for (const i of [1, 2]) {
    const field = str(req.query[`field${i}`])
    const value = typeof req.query[`value${i}`] === 'string' ? (req.query[`value${i}`] as string) : undefined
    if (field && value !== undefined) slices.push({ field, value })
  }
  const limit = Math.min(Number(str(req.query.limit)) || 10, 50)
  res.json(
    await getCreatorDrivers(from, to, basisFromQuery(req), filtersFromQuery(req), detailFromQuery(req), slices, limit, prevRangeFromQuery(req)),
  )
}
