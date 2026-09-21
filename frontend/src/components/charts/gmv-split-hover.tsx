"use client"

import { formatIdr, formatRp } from "@/lib/format"

/**
 * The product-level twin of the overview's GMV decomposition. Same identity —
 * GMV ≡ Creators × GMV per Creator — so the two sides add up to the whole move exactly:
 *
 *   creator effect = ΔCreators × GMV-per-creator before
 *   productivity   = Creators now × ΔGMV-per-creator
 *
 * Shows the before → after figures rather than percentages alone, because at product scale the
 * counts are small enough to be meaningful on their own ("10 → 11 creator" reads better than
 * "+10%").
 */
export function GmvSplitHover({
  gmv,
  gmvPrev,
  creators,
  creatorsPrev,
  compareLabel,
}: {
  gmv: number
  gmvPrev: number
  creators: number
  creatorsPrev: number
  compareLabel: string
}) {
  const perNow = creators > 0 ? gmv / creators : 0
  const perPrev = creatorsPrev > 0 ? gmvPrev / creatorsPrev : 0
  const total = gmv - gmvPrev

  const fromCreators = (creators - creatorsPrev) * perPrev
  const fromPer = creators * (perNow - perPrev)
  const gross = Math.abs(fromCreators) + Math.abs(fromPer)

  // With no comparable base there is nothing to split, and a bar chart of zeros misleads.
  if (creatorsPrev === 0 || gmvPrev === 0) {
    return (
      <span
        className="block w-[300px] rounded-[10px] border border-[var(--ov-track)] p-3.5 text-[12.5px] text-[var(--ov-faint)]"
        style={{ background: "var(--ov-tooltip)" }}
      >
        Tidak ada data pembanding untuk produk ini, jadi perubahannya belum bisa diurai.
      </span>
    )
  }

  const parts = [
    {
      label: "Jumlah creator",
      before: `${formatIdr(creatorsPrev)} → ${formatIdr(creators)} creator`,
      contribution: fromCreators,
    },
    {
      label: "GMV per creator",
      before: `${formatRp(perPrev)} → ${formatRp(perNow)}`,
      contribution: fromPer,
    },
  ]

  return (
    <span
      className="block w-[320px] rounded-[10px] border border-[var(--ov-track)] p-3.5 shadow-[0_18px_40px_-16px_var(--ov-shadow)]"
      style={{ background: "var(--ov-tooltip)" }}
    >
      <span className="block text-[13px] font-semibold">
        Perubahan GMV Affiliate{" "}
        <span style={{ color: total >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}>
          {total >= 0 ? "+" : "−"}
          {formatRp(Math.abs(total))}
        </span>
      </span>
      <span className="mt-0.5 block text-[12px] text-[var(--ov-faint)]">
        GMV ≡ Creators × GMV per Creator · {compareLabel}
      </span>

      {parts.map((part) => {
        const share = gross > 0 ? Math.abs(part.contribution) / gross : 0
        const positive = part.contribution >= 0
        return (
          <span key={part.label} className="mt-2.5 block border-t border-[var(--ov-line)] pt-2.5">
            <span className="flex items-baseline gap-2">
              <span className="flex-1 text-[13px] font-semibold text-[var(--ov-soft)]">{part.label}</span>
              <span
                className="font-mono text-[13px] font-semibold"
                style={{ color: positive ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}
              >
                {positive ? "+" : "−"}
                {formatRp(Math.abs(part.contribution))}
              </span>
            </span>
            <span className="my-1 block h-1.5 overflow-hidden rounded-full bg-[var(--ov-track)]">
              <span
                className="block h-full"
                style={{
                  width: `${share * 100}%`,
                  background: positive ? "var(--ov-green-ink)" : "var(--ov-red-ink)",
                }}
              />
            </span>
            <span className="block font-mono text-[12px] text-[var(--ov-faint)]">{part.before}</span>
          </span>
        )
      })}

      <span className="mt-2.5 block border-t border-[var(--ov-line)] pt-2 text-[12px] text-[var(--ov-faint)]">
        Kedua sisi dijumlahkan persis sama dengan total perubahan.
      </span>
    </span>
  )
}
