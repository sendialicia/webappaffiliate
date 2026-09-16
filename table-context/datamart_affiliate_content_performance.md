Table: MIGRATION.MARKETPLACE.DATAMART_AFFILIATE_CONTENT_PERFORMANCE

grain: date × affiliate_username × brand_name × marketplace_name.
TikTok only — MARKETPLACE_NAME will only ever be 'Tiktok', no Shopee data here.

used for the content conversion funnel section (new content & GMV by pillar,
split video vs live).

TOTAL_NEW_CONTENT = NEW_CONTENT_VIDEO + NEW_CONTENT_LIVE
GMV_VIDEO / GMV_LIVE are pillar-split GMV tied to that content.

⚠️ scope: this table only has content-count and content-GMV metrics.
it does NOT contain creator count, "Profit Creators", or GMV-per-creator —
those come from the order-level table (DATAMART_AFFILIATE_SUMMARY_ORDER),
even though they're shown side-by-side in the same UI section. don't assume
creator aggregates live here.

filter brand via BRAND_NAME, marketplace via MARKETPLACE_NAME.