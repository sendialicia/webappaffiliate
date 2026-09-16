import type { Request, Response } from 'express'
import {
  getPidCategories,
  getPidProductDetail,
  getPidProducts,
  getPidTopCreators,
  getPidTrend,
} from '../services/shopee-pid.service'
import type { ComparisonBasis, TrendGranularity } from '../types/overview'
import type { PidFilters, PidLevel } from '../types/shopee-pid'

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
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
  return req.query.compare === 'ly' ? 'ly' : 'prev'
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
  const brand = str(req.query.brand)
  const scope = str(req.query.scope)
  if (brand) filters.brand = brand
  if (scope) {
    filters.scope = scope
    filters.scopeLevel = levelOf(str(req.query.level))
  }
  return filters
}

export async function getPidCategoriesHandler(req: Request, res: Response) {
  const { from, to } = range(req)
  const level = levelOf(str(req.query.level))
  const data = await getPidCategories(from, to, basisOf(req), filtersOf(req), level)
  res.json(data)
}

export async function getPidProductsHandler(req: Request, res: Response) {
  const { from, to } = range(req)
  const data = await getPidProducts(from, to, basisOf(req), filtersOf(req))
  res.json(data)
}

export async function getPidTrendHandler(req: Request, res: Response) {
  const { from, to } = range(req)
  const data = await getPidTrend(from, to, filtersOf(req), granularityOf(req))
  res.json(data)
}

export async function getPidProductDetailHandler(req: Request, res: Response) {
  const pid = str(req.query.pid)
  if (!pid) {
    res.status(400).json({ error: 'pid is required' })
    return
  }

  const { from, to } = range(req)
  const data = await getPidProductDetail(pid, from, to, basisOf(req), filtersOf(req), granularityOf(req))
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
