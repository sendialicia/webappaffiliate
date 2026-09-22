/** Every filter accepts several values; an empty or absent list means no restriction. */
export interface OverviewFilters {
  brand?: string[]
  marketplace?: string[]
}

/**
 * Dimension filters for the "Filter rincian" row. These only exist on
 * datamart_affiliate_summary_order, so they scope Summary and the sections
 * below it — not the target/achievement sections, which read daily_performance.
 */
export interface DetailFilters {
  pillar?: string[]
  subpillar?: string[]
  pidCategory?: string[]
  pidSubCategory?: string[]
  pidFormat?: string[]
  productCategory?: string[]
  productSubCategory?: string[]
  productFormat?: string[]
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
  /** Last day with actual data this month; pace and projection count days up to it. */
  asOf: string | null
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
  /** null when the bucket holds GMV whose commission has not landed yet. */
  commissionRate: number | null
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
  /**
   * Marketplace → last day whose commission has fully landed, for marketplaces where that falls
   * inside the window. ROI and commission rate are computed only up to it (both windows, same
   * day offset); empty when the whole window is complete.
   */
  commissionCompleteThrough: Record<string, string>
}

/**
 * `category` and `format` keep their original keys so shared URLs stay valid; their labels now
 * say PID explicitly, since the SKU-level product category sits alongside them.
 */
export type CompositionDimension =
  | 'pillar'
  | 'subpillar'
  | 'brand'
  | 'marketplace'
  | 'category'
  | 'pidSubCategory'
  | 'format'
  | 'productCategory'
  | 'productSubCategory'
  | 'productFormat'

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
  comparison: { from: string; to: string; basis: ComparisonBasis }
  totals: { current: number; previous: number; delta: number }
  rows: CompositionRow[]
  trend: CompositionTrendPoint[]
}

export type DriverEntity = 'brand' | 'marketplace'

/** Either side of the driver chart can be any of these; both dropdowns share the list. */
export type DriverField =
  | 'brand'
  | 'marketplace'
  | 'pillar'
  | 'pidCategory'
  | 'pidSubCategory'
  | 'pidFormat'
  | 'subpillar'
  | 'productCategory'
  | 'productSubCategory'
  | 'productFormat'

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
  /** Distinct creators with a sale in the bucket. */
  creators: number
  gmvPerCreator: number | null
  /** Creators active here but not in the comparison period. */
  newCreators: number
  /** GMV, creators and GMV per creator, each against the previous bucket. */
  growth: number | null
  creatorsGrowth: number | null
  gmvPerCreatorGrowth: number | null
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
  /** Content-side figures, only present for TikTok Video/Livestream. */
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

/**
 * Content-side metrics from datamart_affiliate_content_performance. Scope agreed with
 * Sendi: new content and the creator count only. GMV_VIDEO/GMV_LIVE are deliberately
 * not used — they stopped being populated from Aug 2026.
 */
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

/** Last day of data per brand, per source — loads lag and stop at different days per brand. */
export interface DataAvailabilityRow {
  brand: string
  /** Order data (datamart_affiliate_summary_order), affiliate rows only. */
  shopeeOrders: string | null
  tiktokOrders: string | null
  /** Last day with an actual GMV in datamart_affiliate_daily_performance (target table). */
  shopeeActual: string | null
  tiktokActual: string | null
  /** datamart_affiliate_content_performance, TikTok only. */
  tiktokContent: string | null
}

export interface DataAvailabilityResult {
  /** Latest order-data day across every brand: the "data up to" the header shows. */
  latest: string | null
  rows: DataAvailabilityRow[]
}

/** One brand × dimension-value cell of the GMV matrix, both windows. */
export interface MatrixCell {
  gmv: number
  gmvPrev: number
  /** Distinct creators with a sale in the window; never summed across cells. */
  creators: number
  creatorsPrev: number
}

export interface DriverMatrixResult {
  entity: DriverField
  dimension: DriverField
  /** Column order: by GMV, with the folded "Lainnya" last. */
  names: string[]
  /** Row order: by GMV. */
  entities: string[]
  /** cells[entity][name]; absent when neither window has a sale. */
  cells: Record<string, Record<string, MatrixCell>>
  rowTotals: Record<string, MatrixCell>
  columnTotals: Record<string, MatrixCell>
  total: MatrixCell
}

export interface TopCreatorRow {
  username: string
  isManaged: boolean
  gmv: number
  /** Share of the slice's GMV, Agency included in the denominator. */
  share: number
  orders: number
}

export interface TopCreatorsResult {
  /** Slice GMV (every row, Agency included) in the current window. */
  total: number
  /** GMV booked under the aggregated "Agency" username, which is not one creator. */
  agencyGmv: number
  rows: TopCreatorRow[]
  /** Top-N share of slice GMV excluding Agency, current and comparison window. */
  topShare: number | null
  topSharePrev: number | null
}

export interface GmvPair {
  name: string
  gmv: number
  gmvPrev: number
}

/** Inputs the rule-based findings need beyond the page's own sections. */
export interface FindingsInputsResult {
  brands: GmvPair[]
  pillars: GmvPair[]
}

export interface CreatorDriverRow {
  username: string
  isManaged: boolean
  gmv: number
  gmvPrev: number
  delta: number
  /** Share of the slice's gross gains (gainers) or gross losses (losers). */
  share: number
}

export interface CreatorDriversResult {
  gmv: number
  gmvPrev: number
  /** Sum of every creator's positive and negative moves, the bases the shares are read against. */
  grossGain: number
  grossLoss: number
  /** The aggregated Agency row, reported apart: it is not one creator. */
  agencyGmv: number
  agencyGmvPrev: number
  gainers: CreatorDriverRow[]
  losers: CreatorDriverRow[]
}
