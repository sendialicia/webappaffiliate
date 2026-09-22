"use client"

import { useState } from "react"
import { formatIdr, formatPercent, formatSignedPercent } from "@/lib/format"
import type { VariantContribution as Variant } from "@/types/shopee-pid"

const VISIBLE = 6

/**
 * How a listing's GMV splits across its variants (shades, sizes, bundles): which option carries
 * the PID, and which ones grew or shrank. Invisible at PID grain, and often the actual answer.
 */
export function VariantContribution({ variants }: { variants: Variant[] }) {
  const [showAll, setShowAll] = useState(false)
  if (variants.length === 0) return null
  const shown = showAll ? variants : variants.slice(0, VISIBLE)
  const top = variants[0]

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-semibold text-[var(--ov-mut)]">Kontribusi variant</span>
        <span className="text-[12.5px] text-[var(--ov-faint)]">
          {variants.length === 1
            ? "listing ini hanya punya 1 variant"
            : `${variants.length} variant · ${top?.name} menyumbang ${formatPercent(top?.share ?? 0)}`}
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {shown.map((v) => {
          const growth = v.gmvPrev > 0 ? (v.gmv - v.gmvPrev) / v.gmvPrev : null
          return (
            <div key={v.variantId} className="grid grid-cols-[minmax(0,1fr)_90px_64px_58px] items-center gap-2 text-[12.5px]">
              <span className="truncate text-[var(--ov-soft)]" title={`${v.name} · ${formatIdr(v.itemsSold)} unit`}>
                {v.name}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--ov-track)]">
                  <span className="block h-full rounded-full bg-[var(--ov-gold)]" style={{ width: `${Math.min(v.share * 100, 100)}%` }} />
                </span>
                <span className="w-9 text-right font-mono text-[var(--ov-soft)]">{formatPercent(v.share, 0)}</span>
              </span>
              <span className="text-right font-mono text-[var(--ov-faint)]" title={formatIdr(v.gmv)}>
                {formatIdr(Math.round(v.gmv / 1e6))}M
              </span>
              <span
                className="text-right font-mono font-semibold"
                style={{ color: growth === null ? "var(--ov-blue)" : growth >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}
              >
                {growth === null ? "baru" : formatSignedPercent(growth)}
              </span>
            </div>
          )
        })}
      </div>
      {variants.length > VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="mt-1.5 text-[12.5px] font-semibold text-[var(--accent-foreground)]"
        >
          {showAll ? "Tampilkan lebih sedikit" : `Lihat semua ${variants.length} variant`}
        </button>
      )}
    </div>
  )
}
