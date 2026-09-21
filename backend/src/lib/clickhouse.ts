import dotenv from 'dotenv'
import { createClient } from '@clickhouse/client'

dotenv.config()

export const clickhouse = createClient({
  url: `${process.env.CLICKHOUSE_SECURE === 'true' ? 'https' : 'http'}://${process.env.CLICKHOUSE_HOST}:${process.env.CLICKHOUSE_PORT}`,
  database: process.env.CLICKHOUSE_DATABASE,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
  // The heaviest queries (all Shopee products over two comparison windows) take
  // ~25s alone and exceeded the 30s default once a few ran at once, surfacing as
  // sporadic 500s. 45s covers that with headroom without making an unreachable
  // ClickHouse (VPN down) hang the page for minutes.
  request_timeout: 45_000,
  // The link to ClickHouse runs over VPN at ~45-56 KB/s uncompressed, so pulling a result set is
  // far more expensive than computing it: 20k rows of trivial `numbers()` took 21s of pure
  // transfer. gzip measured 3.5x faster on the same payload (21.4s -> 6.1s) and costs nothing,
  // since these results are JSON and compress well.
  compression: { response: true },
  clickhouse_settings: {
    // Keeps the connection alive during long queries so proxies do not drop it.
    send_progress_in_http_headers: 1,
    http_headers_progress_interval_ms: '10000',
  },
})