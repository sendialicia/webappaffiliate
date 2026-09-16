Table: MIGRATION.MARKETPLACE.DATAMART_AFFILIATE_SUMMARY_ORDER

grain (daily): creator × product (product_id / variant_id / bundle child) × pillar × marketplace × brand.

contains BOTH affiliate order data (creator + pillar level) AND non-affiliate order
data — when IS_AFFILIATE = FALSE, AFFILIATE_USERNAME is NULL but product_id/pillar/
marketplace/brand fields stay populated. used to compare affiliate contribution vs
total marketplace performance.

product level has 3 sub-levels: product_id, variant_id, bundle child. distinguish
with ITEM_MARKETPLACE_FLAG:
- TRUE  = actual listed marketplace item → use for product-level GMV totals
- FALSE = bundle child/component → excluded, or GMV will double count

TT_* (TikTok) and SP_* (Shopee) columns are product-attribute metrics, prefixed by
platform. NOT at row grain — they repeat across creator/pillar rows for the same
product+date, so dedup before use:
1. MAX() grouped by product_id + date  → collapses duplicate rows
2. if aggregating over a date range: SUM() the per-date MAX values on top
   (nested pattern: inner MAX per product+date, outer SUM across dates)

IS_MANAGED_CREATOR: creator is team-managed vs organic.

filter brand via BRAND_NAME, marketplace via MARKETPLACE_NAME.

PID_CATEGORY / PID_SUB_CATEGORY / PID_FORMAT:
  category at product_id (PID) level — the marketplace listing level.

PRODUCT_CATEGORY / PRODUCT_SUB_CATEGORY / PRODUCT_FORMAT:
  category at SKU level (variant_id) — more granular, since one PID can map
  to multiple SKUs.

→ use PID_* when analyzing at product_id grain, PRODUCT_* when analyzing at
  variant/SKU grain. they can disagree since one PID may bundle SKUs from
  different sub-categories.