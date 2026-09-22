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

export interface SummaryResult {
  current: { from: string; to: string }
  comparison: { from: string; to: string; basis: "prev" | "ly" }
  kpis: SummaryKpis
  trend: SummaryTrendPoint[]
}

/**
 * `category` and `format` keep their original keys so shared URLs stay valid; their labels now
 * say PID explicitly, since the SKU-level product category sits alongside them.
 */
export type CompositionDimension =
  | "pillar"
  | "subpillar"
  | "brand"
  | "marketplace"
  | "category"
  | "pidSubCategory"
  | "format"
  | "productCategory"
  | "productSubCategory"
  | "productFormat"

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
  /** What the row limit left out, so the page can say the bars do not sum to the total. */
  hidden: { rows: number; gmv: number }
  dimension: CompositionDimension
  current: { from: string; to: string }
  comparison: { from: string; to: string; basis: "prev" | "ly" }
  totals: { current: number; previous: number; delta: number }
  rows: CompositionRow[]
  trend: CompositionTrendPoint[]
}

export type DriverEntity = "brand" | "marketplace"

/** Either side of the driver chart can be any of these; both dropdowns share the list. */
export type DriverField =
  | "brand"
  | "marketplace"
  | "pillar"
  | "pidCategory"
  | "pidSubCategory"
  | "pidFormat"
  | "subpillar"
  | "productCategory"
  | "productSubCategory"
  | "productFormat"

export interface DriverChartRow {
  entity: string
  [dimensionValue: string]: string | number
}

export interface EntityGrowthRow {
  entity: string
  growth: number | null
}

export interface DriversResult {
  entity: DriverField
  dimension: DriverField
  names: string[]
  composition: DriverChartRow[]
  growth: DriverChartRow[]
  difference: DriverChartRow[]
  /** Growth of the entity as a whole, recomputed from its totals rather than averaged per name. */
  entityGrowth: EntityGrowthRow[]
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
  contentCreators?: number
  contentCreatorsDeltaPct?: number | null
  newContent?: number
  newContentDeltaPct?: number | null
  gmv: number
  gmvDeltaPct: number | null
  creators: number
  creatorsDeltaPct: number | null
  profitCreators: number
  gmvPerCreator: number
  aov: number
}

export interface FunnelContent {
  available: boolean
  creatorsPosting: number
  creatorsPostingDeltaPct: number | null
  totalNewContent: number
  totalNewContentDeltaPct: number | null
  /** Last day the content table has data for this brand filter (TikTok only); loads lag per brand. */
  lastDate: string | null
}

export interface FunnelMarketplace {
  name: string
  stages: FunnelStage[]
  rates: FunnelRate[]
  pillars: FunnelPillar[]
  content: FunnelContent
}

export interface FunnelResult {
  marketplaces: FunnelMarketplace[]
  unavailable: string[]
}

export type DetailFilterKey =
  | "pillar"
  | "subpillar"
  | "pidCategory"
  | "pidSubCategory"
  | "pidFormat"
  | "productCategory"
  | "productSubCategory"
  | "productFormat"

export type DetailFilters = Partial<Record<DetailFilterKey, string[]>>

export interface FilterOption {
  key: DetailFilterKey
  label: string
  values: string[]
}

export interface FilterOptionsResult {
  brands: string[]
  marketplaces: string[]
  dimensions: FilterOption[]
}

/** Last day of data per brand, per source — loads lag and stop at different days per brand. */
export interface DataAvailabilityRow {
  brand: string
  shopeeOrders: string | null
  tiktokOrders: string | null
  shopeeActual: string | null
  tiktokActual: string | null
  tiktokContent: string | null
}

export interface DataAvailabilityResult {
  latest: string | null
  rows: DataAvailabilityRow[]
}
