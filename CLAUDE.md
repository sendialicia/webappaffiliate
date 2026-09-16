# Project: Paragon Affiliate Performance Analytical Web App

## What we're building

An analytical web app, not a static dashboard. The point isn't to reproduce
the Tableau version in a browser — it's to use what only a web app can do:
click-to-drill interactivity, shareable views, live computation from
ClickHouse. Not a "filter and look" BI page. Still, some visuals/tables are
just reference detail and don't need to be interactive — not everything
needs a drill.

## Who it's for

Business users on the affiliate marketing / e-commerce team — brand
managers, commercial leads. No SQL or BI-tool fluency assumed. Users
control what they look at (brand, marketplace, pillar, date range); the app
decides how it's charted — never a raw chart-type picker.

## The data

- ClickHouse, ingested from Snowflake datamarts. Connection via `.env`
  (`CLICKHOUSE_HOST/PORT/DATABASE/USER/PASSWORD/SECURE`).
- Table context lives in `table-context/`, one file per table — **always
  read the relevant file before writing a query against that table**:
  - `table-context/datamart_affiliate_summary_order.md` — affiliate +
    non-affiliate order data, creator × product × pillar grain
  - `table-context/datamart_affiliate_daily_performance.md` — achievement
    vs pool target, brand × marketplace level (EAV pattern)
  - `table-context/datamart_affiliate_content_performance.md` — TikTok
    content funnel (new content, GMV by pillar), video/live split
  - Creator page is deferred — its table-context files will be added when
    that page starts (see Notes)
- UI mockup reference (HTML, dark navy/gold): `reference/`

## Core metrics

- **Additive** (safe to SUM across brand/marketplace/pillar/date): GMV,
  Items Sold, Attributed Orders, Commission, Refund Amount, New Content
  count, Impressions, Clicks.
- **Rate metrics** — never sum/average directly, always recompute from
  underlying totals: AOV (GMV ÷ Orders), IR / target achievement (Actual
  GMV ÷ Pool Target), CTR (Clicks ÷ Impressions), CO Rate.
- Performance is judged **both** vs pool target (`DAILY_POOL_TARGET` in
  `datamart_affiliate_daily_performance`) where available, **and**
  current-vs-previous period for flexible windows (MTD/QTD/YTD/last
  quarter/custom). For custom range with "auto" previous period: previous
  period length = current range length, ending right before current range
  starts.

> Note for Sendi: confirm if "vs plan" language should stay framed around
> pool target specifically (only exists for brand×marketplace grain, not
> product/creator grain) — flag this to me if a page needs target
> comparison at a grain the target table doesn't support.

## Design principles

1. Click-to-drill when possible and suitable — clicking a chart element
   filters/highlights the rest of the page, not just a hover tooltip (but
   still needs hover + tooltip).
2. Meaningful views are shareable via URL state, not trapped in local
   component state.
3. Responsive down to a reasonably narrow viewport.
4. Summaries (where a section needs one) are **rule-based text
   placeholders**, not AI-generated — clear, concise, and transparent
   about why a number triggered that summary. Consideration prompts
   ("worth checking further"), not action items.

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui,
  Zustand, Recharts, Maps
- **Identity & Security**: Keycloak ↔ Microsoft Entra ID, JWT/JWKS
  (RS256) — future work, don't build this until explicitly needed
- **Backend**: Node.js 20, Express 4, routers → middleware → controllers →
  services architecture, `@clickhouse/client`
- **Data**: ClickHouse

## Repository structure

Monorepo, frontend and backend as separate apps:

```
project-root/
├── CLAUDE.md
├── .env
├── reference/                  # mockup HTML (dark navy/gold)
├── table-context/               # one .md per ClickHouse table
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── overview/page.tsx
│       │   ├── shopee-pid/page.tsx
│       │   ├── tiktok-pid/page.tsx
│       │   ├── sku/page.tsx
│       │   └── layout.tsx
│       ├── components/
│       │   ├── ui/              # shadcn primitives
│       │   └── charts/
│       ├── lib/                 # API client, URL-state helpers
│       ├── store/               # Zustand stores
│       └── types/
└── backend/
    └── src/
        ├── routers/              # route definitions per resource
        ├── middleware/           # auth (later), error handling, validation
        ├── controllers/          # request/response glue
        ├── services/             # business logic, ClickHouse queries
        ├── lib/
        │   └── clickhouse.ts
        └── types/
```

Query efficiency: reuse a single query's result across multiple visuals on
the same page where the grain allows it, instead of firing one query per
chart — you're the one building this, make the call on where that applies.

## Pages

Overview, Shopee PID, TikTok PID, SKU. **Creator page is planned but
deferred** — don't build it yet; its table-context files will be added
when work on it starts, and this file should get a short update noting
what changed (new tables, new page folder) at that point.

## Out of scope for now

- Creator page (see above)
- Auth implementation (Keycloak/Entra ID) — stack choice only, not built yet
