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
1. MAX() grouped by product_id + date + SP_CHANNEL_TYPE  → collapses duplicate rows
2. if aggregating over a date range: SUM() the per-date MAX values on top
   (nested pattern: inner MAX per group, outer SUM across dates)

SP_CHANNEL_TYPE must be in that GROUP BY. SP_* values differ per channel (Media
sosial / Video / Live, plus an unlabelled one), so grouping on product+date alone
keeps whichever channel is largest and drops the others — that lost 34% of Shopee
SP GMV (18.22B vs 27.62B over 1-15 Sep 2026). TikTok rows carry no channel, so
including the column is harmless there: it adds a single '(none)' group and leaves
TT_* untouched.

SKU / cross-marketplace grain:
- BARCODE identifies one physical SKU and is 100% populated. The same barcode appears on
  both marketplaces, which is what makes a cross-marketplace SKU view possible: 1,835 of
  2,219 barcodes (99.9% of GMV) sell on both over 1-15 Sep 2026 in the split mode below.
- VARIANT_SAP_NAME is the SKU name, but only ~82% populated at listing level; the gap is
  paket/bundle listings whose VARIANT_NAME alone is ambiguous ("32 N + 32 N"). Resolve the
  name with argMax on (ETL_BATCH_TIME, DATE) — a barcode renamed mid-period otherwise
  splits into two rows. The same applies to PRODUCT_NAME per PRODUCT_ID: 156 PIDs carry
  more than one listing title in a single 15-day window.
- BUNDLE_FLAG / ITEM_MARKETPLACE_FLAG are the two populations behind the dashboard's
  "Bundle Dipecah" control, and they are NOT subsets of one another:
    bundle split on  -> BUNDLE_FLAG = FALSE            (2,219 barcodes, 81.31B)
    bundle split off -> ITEM_MARKETPLACE_FLAG = TRUE   (9,603 barcodes, 87.71B)
- GWP_FLAG = TRUE marks giveaway rows (471 barcodes, 0.06B). Exclude unless asked for, or
  every rate metric is diluted. ITEM_WITH_GWP_FLAG is a different, near-empty column.
- SP_*/TT_* attribute columns cannot be used at SKU grain: they are per PID, and one PID
  maps to up to 7 barcodes, so there is no way to split them across a PID's SKUs. Only the
  order columns (GMV, ITEMS_SOLD, ATTRIBUTED_ORDERS, COMMISSION, REFUND_AMOUNT) compare
  across marketplaces.

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