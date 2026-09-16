import { formatNumber, formatPercent, formatRpFull, formatSignedPercent } from "@/lib/format"
import type { FunnelMarketplace } from "@/types/overview"

function deltaColor(delta: number | null): string {
  if (delta === null) return "var(--ov-faint)"
  return delta >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)"
}

/** This section is about content performance, so channels that carry no content are left out. */
const NON_CONTENT_PILLARS = new Set(["Product Card", "Unknown"])

export function ContentFunnel({ marketplace }: { marketplace: FunnelMarketplace }) {
  const pillars = marketplace.pillars.filter((p) => !NON_CONTENT_PILLARS.has(p.name))
  // Impressions dwarf the content count, so the bars scale to the largest stage, not the first.
  const top = Math.max(0, ...marketplace.stages.map((s) => s.value))

  return (
    <div className="flex flex-col">
      <div className="mb-2.5 rounded-md border border-[var(--accent)] bg-[var(--accent)] p-1.5 text-center text-[15px] font-semibold font-(family-name:--font-archivo)">
        {marketplace.name}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {pillars.slice(0, 4).map((pillar) => (
          <div
            key={pillar.name}
            className="overflow-hidden rounded-lg border border-[var(--ov-line)]"
            style={{ background: "var(--ov-card-gradient)" }}
          >
            <div className="bg-[var(--ov-line)] p-1.5 text-center text-[13px] font-semibold text-[var(--ov-soft)]">
              {pillar.name}
            </div>
            {/* Total creator and new content come from the TikTok-only content table, so on
                Shopee they are absent rather than zero. */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 p-3">
              <Stat label="GMV per Creator" value={formatRpFull(pillar.gmvPerCreator)} delta={null} />
              <Stat
                label="Total Creator"
                value={pillar.contentCreators === undefined ? null : formatNumber(pillar.contentCreators)}
                delta={pillar.contentCreatorsDeltaPct ?? null}
              />
              <Stat
                label="# New Content"
                value={pillar.newContent === undefined ? null : formatNumber(pillar.newContent)}
                delta={pillar.newContentDeltaPct ?? null}
              />
              <Stat label="Profit Creators" value={formatNumber(pillar.profitCreators)} delta={pillar.creatorsDeltaPct} />
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-3 flex-1 rounded-lg border border-[var(--ov-line)] p-4"
        style={{ background: "var(--ov-card-gradient)" }}
      >
        <div className="mb-3 text-[11.5px] font-bold tracking-wider text-[var(--ov-head)] uppercase">
          Conversion funnel
        </div>

        <div className="flex flex-col items-center gap-1.5">
          {marketplace.stages.map((stage, i) => {
            const width = top > 0 ? Math.min(Math.max((stage.value / top) * 100, 12), 100) : 12
            const rate = marketplace.rates[i - 1]

            return (
              <div key={stage.key} className="flex w-full flex-col items-center">
                {i > 0 && (
                  <div className="py-0.5 text-[11px] text-[var(--ov-faint)]">
                    {rate?.value !== null && rate?.value !== undefined ? (
                      <>
                        <span className="font-semibold text-[var(--accent-foreground)]">
                          {formatPercent(rate.value, 2)}
                        </span>{" "}
                        {rate.label}
                      </>
                    ) : (
                      "↓"
                    )}
                  </div>
                )}
                <div
                  className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-all"
                  style={{
                    width: `${width}%`,
                    minWidth: 190,
                    background: "linear-gradient(90deg, rgba(242,193,78,0.85), rgba(232,169,58,0.6))",
                  }}
                >
                  <span className="text-[11px] font-bold tracking-wider text-[#0a1628] uppercase">{stage.label}</span>
                  <span className="flex items-center gap-2 font-mono text-[12.5px] font-semibold text-[#0a1628]">
                    {formatNumber(stage.value)}
                    <span className="text-[11px] font-bold" style={{ color: stage.deltaPct !== null && stage.deltaPct >= 0 ? "#1a6b4a" : "#8c2438" }}>
                      {formatSignedPercent(stage.deltaPct)}
                    </span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--ov-line)] pt-2.5 text-[11.5px] text-[var(--ov-faint)]">
          {marketplace.rates.map((rate) => (
            <span key={rate.key}>
              {rate.label}:{" "}
              <span className="font-semibold text-[var(--ov-soft)]">
                {rate.value !== null ? formatPercent(rate.value, 2) : "—"}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, delta }: { label: string; value: string | null; delta: number | null }) {
  if (value === null) {
    return (
      <div>
        <div className="text-[11.5px] text-[var(--ov-mut)]">{label}</div>
        <div className="mt-0.5 font-mono text-[14px] font-semibold text-[var(--ov-dim)]">—</div>
        <div className="text-[12px] font-semibold text-[var(--ov-faint)]">tidak tersedia</div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-[11.5px] text-[var(--ov-mut)]">{label}</div>
      <div className="mt-0.5 font-mono text-[14px] font-semibold">{value}</div>
      {delta !== null && (
        <div className="text-[12px] font-semibold" style={{ color: deltaColor(delta) }}>
          {formatSignedPercent(delta)}
        </div>
      )}
    </div>
  )
}
