export interface Lever {
  name: string
  /** Value in the comparison window, then in the current one. */
  prev: number
  now: number
  /** How the lever reads on its own — a count, a rate, or money. */
  format: (v: number) => string
}

/**
 * Splits a GMV move across the levers of an identity, e.g.
 *
 *   GMV = Impressions × CTR × CO rate × AOV
 *
 * by chain substitution: swap one lever to this period, hold the rest at last period's value,
 * and the jump in the product is that lever's bar. Because the identity multiplies out exactly,
 * the bars close on the real change with no residual and no "other" bar — for any product and
 * any window.
 *
 * The split does depend on the order the levers are swapped in, which the panel says out loud.
 * The order is fixed from most upstream to most downstream, and AOV goes last so everything
 * before it sums to exactly the "Orders" term of GMV = Orders × AOV.
 */
export function decompose(levers: Lever[]): Array<{ name: string; delta: number }> {
  const values = levers.map((l) => l.prev)
  const product = (v: number[]) => v.reduce((a, b) => a * b, 1)

  let running = product(values)
  return levers.map((lever, i) => {
    values[i] = lever.now
    const next = product(values)
    const delta = next - running
    running = next
    return { name: lever.name, delta }
  })
}
