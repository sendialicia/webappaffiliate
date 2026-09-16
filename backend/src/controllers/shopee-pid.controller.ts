import type { Request, Response } from 'express'
import {
  getPidCategories,
  getPidProductDetail,
  getPidProducts,
  getPidTopCreators,
  getPidTrend,
} from '../services/shopee-pid.service'
import type { ComparisonBasis, DetailFilters, TrendGranularity } from '../types/overview'
import type { PidFilters, PidLevel } from '../types/shopee-pid'

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

function levelOf(value: unknown): PidLevel {
  return value === 'subcategory' || value === 'format' ? value : 'category'
}

function filtersOf(req: Request): PidFilters {
  const filters: PidFilters = {}
  const brand = list(req.query.brand)
  const scope = list(req.query.scope)
  const detail = detailOf(req)
  if (brand.length > 0) filters.brand = brand
  if (scope.length > 0) {
    filters.scope = scope
    filters.scopeLevel = levelOf(str(req.query.level))
  }
  if (Object.keys(detail).length > 0) filters.detail = detail
  return filters
}

/** PID dimension filters, same keys as the overview's "filter rincian". */
function detailOf(req: Request): DetailFilters {
  const detail: DetailFilters = {}
  for (const key of ['pillar', 'pidCategory', 'pidSubCategory', 'pidFormat'] as const) {
    const values = list(req.query[key])
    if (values.length > 0) detail[key] = values
  }
  return detail
}

export async function getPidCategoriesHandler(req: Request, res: Response) {
  const { from, to } = range(req)
  const level = levelOf(str(req.query.level))
  const data = await getPidCategories(from, to, basisOf(req), filtersOf(req), level, prevRangeOf(req))
  res.json(data)
}

export async function getPidProductsHandler(req: Request, res: Response) {
  const { from, to } = range(req)
  const data = await getPidProducts(from, to, basisOf(req), filtersOf(req), prevRangeOf(req))
  res.json(data)
}

export async function getPidTrendHandler(req: Request, res: Response) {
  const { from, to } = range(req)
  const data = await getPidTrend(from, to, filtersOf(req), granularityOf(req))
  res.json(data)
}

export async function getPidProductDetailHandler(req: Request, res: Response) {
  // One or several products, comma separated; several are reported as one combined detail.
  const pids = (str(req.query.pid) ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  if (pids.length === 0) {
    res.status(400).json({ error: 'pid is required' })
    return
  }

  const { from, to } = range(req)
  const data = await getPidProductDetail(pids, from, to, basisOf(req), filtersOf(req), granularityOf(req), prevRangeOf(req))
  if (!data) {
    res.status(404).json({ error: 'product not found in this period' })
    return
  }
  res.json(data)
}

export async function getPidTopCreatorsHandler(req: Request, res: Response) {
  const { from, to } = range(req)
  const pillar = str(req.query.pillar) ?? null
  const managedParam = str(req.query.managed)
  const managed = managedParam === 'true' ? true : managedParam === 'false' ? false : null
  const limit = Number(str(req.query.limit)) || 25

  const data = await getPidTopCreators(from, to, filtersOf(req), pillar, managed, limit)
  res.json(data)
}
