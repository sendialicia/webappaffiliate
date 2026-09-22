import { formatCompact, formatIdr, formatRp, formatRpFull } from "@/lib/format"

/**
 * A number shown short ("Rp148.2B", "3.5M") with the exact figure on hover, so headline
 * readability never costs the reader the precise value.
 */
export function Num({ value, money = false, className }: { value: number; money?: boolean; className?: string }) {
  const exact = money ? formatRpFull(value) : formatIdr(value)
  return (
    <span title={exact} className={className}>
      {money ? formatRp(value) : formatCompact(value)}
    </span>
  )
}
