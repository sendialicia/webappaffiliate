import dotenv from 'dotenv'
import { createClient } from '@clickhouse/client'

dotenv.config()

export const clickhouse = createClient({
  url: `${process.env.CLICKHOUSE_SECURE === 'true' ? 'https' : 'http'}://${process.env.CLICKHOUSE_HOST}:${process.env.CLICKHOUSE_PORT}`,
  database: process.env.CLICKHOUSE_DATABASE,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
  // The heaviest queries (all Shopee products over two comparison windows) take
  // ~25s alone and exceed the 30s default once a few run at once, which surfaced
  // as sporadic 500s rather than slow responses.
  request_timeout: 120_000,
  clickhouse_settings: {
    // Keeps the connection alive during long queries so proxies do not drop it.
    send_progress_in_http_headers: 1,
    http_headers_progress_interval_ms: '10000',
  },
})