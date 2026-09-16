import { clickhouse } from '../lib/clickhouse'

export async function checkDatabaseConnection() {
  const result = await clickhouse.query({
    query: 'SELECT 1 AS ok',
    format: 'JSONEachRow',
  })
  return result.json()
}
