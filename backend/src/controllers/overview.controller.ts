import type { Request, Response } from 'express'
import {
  getComposition,
  getDailyPerformance,
  getDrivers,
  getFunnel,
  getMonthlyPerformance,
  getProgress,
  getFilterOptions,
  getSpend,
  getSummary,
} from '../services/overview.service'
import type {
  ComparisonBasis,
  CompositionDimension,
  DetailFilters,
  DriverDimension,
  DriverEntity,
  OverviewFilters,
  TrendGranularity,
} from '../types/overview'

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
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
    const value = str(req.query[key])
    if (value) detail[key] = value
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
  const brand = str(req.query.brand)
  const marketplace = str(req.query.marketplace)
  if (brand) filters.brand = brand
  if (marketplace) filters.marketplace = marketplace
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
  const dimension: CompositionDimension =
    dimensionParam === 'category' || dimensionParam === 'format' ? dimensionParam : 'pillar'
  const limit = Math.min(Number(str(req.query.limit)) || 12, 30)

  const data = await getComposition(from, to, basis, filtersFromQuery(req), granularity, dimension, limit, detailFromQuery(req), prevRangeFromQuery(req))
  res.json(data)
}

export async function getDriversHandler(req: Request, res: Response) {
  const to = str(req.query.to) ?? new Date().toISOString().slice(0, 10)
  const from = str(req.query.from) ?? defaultFrom(to)
  const basis: ComparisonBasis = basisFromQuery(req)
  const entity: DriverEntity = req.query.entity === 'marketplace' ? 'marketplace' : 'brand'
  const dimension: DriverDimension = req.query.dimension === 'category' ? 'category' : 'format'
  const limit = Math.min(Number(str(req.query.limit)) || 10, 20)

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

  const data = await getFunnel(from, to, basis, filtersFromQuery(req))
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
