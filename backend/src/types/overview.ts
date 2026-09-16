export interface OverviewFilters {
  brand?: string
  marketplace?: string
}

/**
 * Dimension filters for the "Filter rincian" row. These only exist on
 * datamart_affiliate_summary_order, so they scope Summary and the sections
 * below it — not the target/achievement sections, which read daily_performance.
 */
export interface DetailFilters {
  pillar?: string
  subpillar?: string
  pidCategory?: string
  pidSubCategory?: string
  pidFormat?: string
  productCategory?: string
  productSubCategory?: string
  productFormat?: string
}

export interface FilterOption {
  key: keyof DetailFilters
  label: string
  values: string[]
}

export interface FilterOptionsResult {
  brands: string[]
  marketplaces: string[]
  dimensions: FilterOption[]
}

export interface MonthlyPerformancePoint {
  month: string
  actualGmv: number
  lyGmv: number
  target: number
}

export interface PaceSummary {
  monthLabel: string
  actual: number
  target: number
  expected: number
  remaining: number
  daysElapsed: number
  daysInMonth: number
  daysLeft: number
  projection: number
  actualPct: number
  expectedPct: number
}

export interface MonthlyPerformanceResult {
  months: MonthlyPerformancePoint[]
  pace: PaceSummary
}

export interface DailyPerformancePoint {
  date: string
  actualGmv: number
  lyGmv: number
  target: number
}

export interface ProgressRow {
  name: string
  actual: number
  target: number
  pct: number
}

export interface ProgressResult {
  marketplace: ProgressRow[]
  brand: ProgressRow[]
}

export interface KpiValue {
  value: number
  delta: number
  deltaPct: number | null
}

export interface SummaryKpis {
  gmv: KpiValue
  creators: KpiValue
  gmvPerCreator: KpiValue
  asp: KpiValue
  aov: KpiValue
  commission: KpiValue
  affiliateShare: KpiValue
  // Affiliate health (section 8). ROI = GMV / Commission, confirmed with Sendi.
  commissionRate: KpiValue
  roi: KpiValue
  refundRate: KpiValue
  itemsSold: KpiValue
}

export interface SummaryTrendPoint {
  bucket: string
  gmv: number
  creators: number
  gmvPerCreator: number
  asp: number
  aov: number
  commission: number
  affiliateShare: number
  commissionRate: number
  /** null when the bucket has no commission booked yet (ETL lags GMV by ~2 days). */
  roi: number | null
  refundRate: number
  itemsSold: number
}

export type ComparisonBasis = 'prev' | 'ly' | 'custom'
export type TrendGranularity = 'day' | 'week' | 'month'

export interface SummaryResult {
  current: { from: string; to: string }
  comparison: { from: string; to: string; basis: ComparisonBasis }
  kpis: SummaryKpis
  trend: SummaryTrendPoint[]
}

export type CompositionDimension = 'pillar' | 'category' | 'format'

export interface CompositionRow {
  name: string
  gmv: number
  gmvPrev: number
  delta: number
  share: number
  growth: number | null
  creators: number
  creatorsPrev: number
  creatorsGrowth: number | null
  gmvPerCreator: number
  gmvPerCreatorPrev: number
}

export interface CompositionTrendPoint {
  bucket: string
  [dimensionValue: string]: string | number
}

export interface CompositionResult {
  dimension: CompositionDimension
  current: { from: string; to: string }
  comparison: { from: string; to: string; basis: ComparisonBasis }
  totals: { current: number; previous: number; delta: number }
  rows: CompositionRow[]
  trend: CompositionTrendPoint[]
}

export type DriverEntity = 'brand' | 'marketplace'
export type DriverDimension = 'format' | 'category'

export interface DriverChartRow {
  entity: string
  [dimensionValue: string]: string | number
}

export interface DriversResult {
  entity: DriverEntity
  dimension: DriverDimension
  names: string[]
  composition: DriverChartRow[]
  growth: DriverChartRow[]
  difference: DriverChartRow[]
}

export interface SpendRow {
  name: string
  gmv: number
  commission: number
  commissionRate: number
  roi: number
  creators: number
  gmvPerCreator: number
}

export interface AcquisitionPoint {
  bucket: string
  gmv: number
  newCreators: number
  growth: number | null
}

export interface SpendResult {
  entity: DriverEntity
  rows: SpendRow[]
  acquisition: AcquisitionPoint[]
}

export interface FunnelStage {
  key: string
  label: string
  value: number
  prev: number
  deltaPct: number | null
}

export interface FunnelRate {
  key: string
  label: string
  value: number | null
  prev: number | null
}

export interface FunnelPillar {
  name: string
  gmv: number
  gmvDeltaPct: number | null
  creators: number
  creatorsDeltaPct: number | null
  profitCreators: number
  gmvPerCreator: number
  aov: number
}

export interface FunnelMarketplace {
  name: string
  stages: FunnelStage[]
  rates: FunnelRate[]
  pillars: FunnelPillar[]
}

export interface FunnelResult {
  marketplaces: FunnelMarketplace[]
  unavailable: string[]
}
