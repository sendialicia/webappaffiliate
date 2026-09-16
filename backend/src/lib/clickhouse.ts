import dotenv from 'dotenv'
import { createClient } from '@clickhouse/client'

dotenv.config()

export const clickhouse = createClient({
  url: `${process.env.CLICKHOUSE_SECURE === 'true' ? 'https' : 'http'}://${process.env.CLICKHOUSE_HOST}:${process.env.CLICKHOUSE_PORT}`,
  database: process.env.CLICKHOUSE_DATABASE,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
})