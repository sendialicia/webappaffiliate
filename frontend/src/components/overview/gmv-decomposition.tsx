"use client"

import { formatPercent, formatSignedPercent } from "@/lib/format"
import type { KpiValue } from "@/types/overview"
import { Num } from "@/components/num"

/**
 * Splits the GMV change into the two things that can move it, using the identity
 * GMV ≡ Creators × GMV per Creator:
 *
 *   creator effect    = ΔCreators × GMV-per-creator before
 *   productivity      = Creators now × ΔGMV-per-creator
 *
 * The two add up to the total change exactly, so the card can say which side moved it.
 */
function decompose(gmv: KpiValue, creators: KpiValue, gmvPerCreator: KpiValue) {
  const creatorsPrev = creators.value - creators.delta
  const perCreatorPrev = gmvPerCreator.value - gmvPerCreator.delta

  const fromCreators = creators.delta * perCreatorPrev
  const fromPerCreator = creators.value * gmvPerCreator.delta
  const gross = Math.abs(fromCreators) + Math.abs(fromPerCreator)

  return {
    total: gmv.delta,
    totalPct: gmv.deltaPct,
    parts: [
      {
        label: "Creators",
        pct: creators.deltaPct,
        contribution: fromCreators,
        share: gross > 0 ? Math.abs(fromCreators) / gross : 0,
        prev: creatorsPrev,
      },
      {
        label: "GMV per Creator",
        pct: gmvPerCreator.deltaPct,
        contribution: fromPerCreator,
        share: gross > 0 ? Math.abs(fromPerCreator) / gross : 0,
        prev: perCreatorPrev,
      },
    ],
  }
}

export function GmvDecomposition({
  gmv,
  creators,
  gmvPerCreator,
  compareLabel,
}: {
  gmv: KpiValue
  creators: KpiValue
  gmvPerCreator: KpiValue
  compareLabel: string
}) {
  const d = decompose(gmv, creators, gmvPerCreator)

  return (
    <div
      className="w-[318px] rounded-[10px] border border-[var(--ov-track)] p-3.5 shadow-[0_18px_40px_-16px_var(--ov-shadow)]"
      style={{ background: "var(--ov-tooltip)" }}
    >
      <div className="text-[12px] font-bold tracking-[0.1em] text-[var(--ov-faint)] uppercase">
        Dari mana perubahan ini berasal
      </div>
      <div className="mt-1 text-[12.5px] leading-relaxed text-[var(--ov-faint)]">
        GMV ≡ Creators × GMV per Creator · {compareLabel}
      </div>

      {d.parts.map((p) => {
        const color = p.contribution >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)"
        return (
          <div key={p.label} className="mt-3">
            <div className="flex items-baseline justify-between gap-2.5">
              <span className="text-[13px] font-semibold text-[var(--ov-soft)]">{p.label}</span>
              <span className="font-mono text-[13px] font-semibold" style={{ color }}>
                {formatSignedPercent(p.pct, 2)}
              </span>
            </div>
            <div className="my-1.5 h-1.5 overflow-hidden rounded bg-[var(--ov-track)]">
              <span className="block h-full" style={{ width: `${p.share * 100}%`, background: color }} />
            </div>
            <div className="text-[12.5px] text-[var(--ov-faint)]">
              {p.contribution >= 0 ? "+" : "−"}
              <Num money value={Math.abs(p.contribution)} /> · {formatPercent(p.share, 0)} dari pergerakan kotor
            </div>
          </div>
        )
      })}

      <div className="mt-3 flex items-baseline justify-between gap-2.5 border-t border-[var(--ov-line)] pt-2.5">
        <span className="text-[12.5px] text-[var(--ov-faint)]">Total perubahan GMV</span>
        <span
          className="font-mono text-[13px] font-semibold"
          style={{ color: d.total >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}
        >
          {formatSignedPercent(d.totalPct)} · {d.total >= 0 ? "+" : "−"}
          <Num money value={Math.abs(d.total)} />
        </span>
      </div>
    </div>
  )
}
