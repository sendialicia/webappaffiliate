Table: MIGRATION.MARKETPLACE.DATAMART_AFFILIATE_DAILY_PERFORMANCE

grain: brand × marketplace × period_date × metric_name (EAV pattern).
achievement/target data for Shopee & TikTok, brand-marketplace level only
(no product/creator breakdown).

load pattern: DELETE + INSERT per (PERIOD_DATE, MARKETPLACE_NAME, REGION_CODE)
per ETL run — full replace, not append. previously had a GROUP BY bug that
leaked ETL_BATCH_TIME as a grouping key instead of MAX()-ing it, causing
duplicate rows per key (same METRIC_VALUE, different ETL_BATCH_TIME) — fixed
as of [tanggal fix]. defensive practice: still dedup with
  QUALIFY ROW_NUMBER() OVER (
    PARTITION BY PERIOD_DATE, BRAND_NAME, MARKETPLACE_NAME, METRIC_NAME
    ORDER BY DATA_EXTRACT_TIMESTAMP DESC, ETL_BATCH_TIME DESC
  ) = 1
before aggregating, in case the bug regresses.

second duplicate source — two target versions: some brand × marketplace keys carry
two 'Actual GMV' rows with the SAME METRIC_VALUE and ETL_BATCH_TIME but DIFFERENT
DAILY_POOL_TARGET, one per target-sheet extract (DATA_EXTRACT_TIMESTAMP 2026-03-23
vs the revised 2026-08-18). Seen all year on Labore/Tavi Shopee, one month on Putri
Tiktok and Biodef Shopee. ETL_BATCH_TIME ties there, so ordering by it alone picks a
version at random — DATA_EXTRACT_TIMESTAMP DESC must come first to keep the latest
target. A raw SUM(DAILY_POOL_TARGET) counts both versions (Jan 2026: 132.83B raw vs
125.38B latest-only).

METRIC_NAME (EAV): 'LY GMV', 'Actual GMV' — values live in METRIC_VALUE.
LY_GMV_CONTRIBUTION_PCT, DAILY_POOL_TARGET, ACTUAL_ORDERS, ACTUAL_COMMISSION
are only populated on 'Actual GMV' rows, NULL on 'LY GMV' rows.

REGION_CODE: 'id' and 'my' both exist, but only 'id' is currently used in
the dashboard — filter WHERE REGION_CODE = 'id' unless told otherwise.

filter brand via BRAND_NAME, marketplace via MARKETPLACE_NAME.