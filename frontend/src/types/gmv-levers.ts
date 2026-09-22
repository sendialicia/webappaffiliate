/** Mirrors backend/src/services/gmv-levers.service.ts. Only additive totals; rates are derived. */
export type LeverMarketplace = "Tiktok" | "Shopee"

export interface LeverWindow {
  gmv: number
  orders: number
  clicks: number
  /** null on Shopee: its affiliate centre reports no impressions. */
  impressions: number | null
}

export interface MarketplaceLevers {
  marketplace: LeverMarketplace
  current: LeverWindow
  previous: LeverWindow
}

export interface BrandLevers {
  brand: string
  marketplaces: MarketplaceLevers[]
}

export interface GmvLeversResult {
  current: { from: string; to: string }
  comparison: { from: string; to: string }
  total: MarketplaceLevers[]
  brands: BrandLevers[]
  /** Detail filters that were set but cannot apply to product-level funnel numbers. */
  ignoredFilters: string[]
  /** Marketplace → last day with funnel data, when that is before the window's end. */
  funnelThrough: Partial<Record<LeverMarketplace, string>>
}
