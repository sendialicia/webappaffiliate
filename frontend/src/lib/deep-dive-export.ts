import type { CsvRow } from "@/lib/csv"

/**
 * Rows for the products (or SKUs) picked in the table, in the order they were picked, plus a
 * TOTAL row from the deep dive when more than one is picked. The total comes from the backend's
 * combined detail rather than summing the rows, so distinct creators and the rate metrics are
 * recomputed, not added up.
 *
 * A picked id that is no longer in the table (the scope changed after picking) falls back to
 * the member row the detail returned, so it still appears in the file with its GMV.
 */
export function selectionRows<T>({
  selected,
  rows,
  idOf,
  flatten,
  members,
  idColumn,
  total,
}: {
  selected: string[]
  rows: T[]
  idOf: (row: T) => string
  flatten: (row: T) => CsvRow
  members: Array<{ id: string; name: string; gmv: number }>
  idColumn: string
  total: CsvRow | null
}): CsvRow[] {
  const byId = new Map(rows.map((r) => [idOf(r), r]))
  const memberById = new Map(members.map((m) => [m.id, m]))
  const out: CsvRow[] = selected.map((id) => {
    const row = byId.get(id)
    if (row) return flatten(row)
    const m = memberById.get(id)
    return { [idColumn]: id, name: m?.name ?? "", gmv: m?.gmv ?? null }
  })
  if (total && selected.length > 1) out.push(total)
  return out
}

/** Current vs comparison window for every numeric field the two objects share. */
export function comparisonRows(
  current: Record<string, unknown>,
  previous: Record<string, unknown>,
): CsvRow[] {
  return Object.keys(current)
    .filter((k) => typeof current[k] === "number" || current[k] === null)
    .map((k) => {
      const cur = current[k] as number | null
      const prev = typeof previous[k] === "number" ? (previous[k] as number) : null
      return {
        metrik: k,
        periodeIni: cur,
        periodePembanding: prev,
        selisih: cur !== null && prev !== null ? cur - prev : null,
        growth: cur !== null && prev ? (cur - prev) / Math.abs(prev) : null,
      }
    })
}

/** Joins the picked ids into one cell, so each deep-dive file says which selection it is. */
export function selectionLabel(ids: string[]): string {
  return ids.join(" | ")
}
