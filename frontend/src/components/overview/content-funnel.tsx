import { formatNumber, formatPercent, formatRpFull, formatSignedPercent } from "@/lib/format"
import type { FunnelMarketplace } from "@/types/overview"

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

function deltaColor(delta: number | null): string {
  if (delta === null) return "var(--ov-faint)"
  return delta >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)"
}

/** This section is about content performance, so channels that carry no content are left out. */
const NON_CONTENT_PILLARS = new Set(["Product Card", "Unknown"])

export function ContentFunnel({ marketplace, periodTo }: { marketplace: FunnelMarketplace; periodTo: string }) {
  const isTiktok = marketplace.name.toLowerCase() === "tiktok"
  // Content loads stop at different days per brand; say so rather than let a gap read as zero.
  const contentLastDate = marketplace.content.lastDate
  const contentStale = isTiktok && contentLastDate !== null && contentLastDate < periodTo
  // Shopee has no content table at all; on TikTok a missing figure means no rows for this filter.
  const missingNote = isTiktok ? "tidak ada data konten" : "tidak tersedia"
  const pillars = marketplace.pillars.filter((p) => !NON_CONTENT_PILLARS.has(p.name))

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
                missingNote={missingNote}
              />
              <Stat
                label="# New Content"
                value={pillar.newContent === undefined ? null : formatNumber(pillar.newContent)}
                delta={pillar.newContentDeltaPct ?? null}
                missingNote={missingNote}
              />
              <Stat label="Profit Creators" value={formatNumber(pillar.profitCreators)} delta={pillar.creatorsDeltaPct} />
            </div>
          </div>
        ))}
      </div>

      {contentStale && (
        <div className="mt-2.5 rounded-md border border-[var(--ov-gold)]/35 bg-[var(--ov-gold)]/10 px-3 py-2 text-[13px] leading-relaxed text-[var(--ov-soft)]">
          Data new content untuk filter ini baru sampai{" "}
          <span className="font-semibold">{formatDate(contentLastDate)}</span>, jadi Total Creator dan # New Content
          setelah tanggal itu belum terhitung.
        </div>
      )}

      <div
        className="mt-3 flex-1 rounded-lg border border-[var(--ov-line)] p-4"
        style={{ background: "var(--ov-card-gradient)" }}
      >
        <div className="mb-3 text-[12.5px] font-bold tracking-wider text-[var(--ov-head)] uppercase">
          Conversion funnel
        </div>

        <FunnelStages marketplace={marketplace} />
      </div>
    </div>
  )
}

/**
 * Stage palettes, dark to light down the funnel. Fixed hex rather than theme tokens: they are
 * marketplace identity colours and carry their own text colour, so they read on either theme.
 */
const FUNNEL_PALETTES: Record<string, [string, string]> = {
  shopee: ["#9a3412", "#fdba74"],
  tiktok: ["#4c1d95", "#93c5fd"],
}
const DEFAULT_PALETTE: [string, string] = ["#1e3a8a", "#93c5fd"]

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function stageColor([from, to]: [string, string], index: number, count: number): { bg: string; ink: string } {
  const t = count > 1 ? index / (count - 1) : 0
  const a = hexToRgb(from)
  const b = hexToRgb(to)
  const rgb = a.map((c, i) => Math.round(c + ((b[i] ?? c) - c) * t)) as [number, number, number]
  const luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
  return { bg: `rgb(${rgb.join(",")})`, ink: luminance > 0.6 ? "#0a1628" : "#ffffff" }
}

/** Bar widths as % of the bar column; the rest is left for the delta and step rate. */
const BAR_MAX = 72
const BAR_MIN = 28

/**
 * Impressions run ~100x clicks on TikTok, so a linear scale leaves every stage after the first
 * as the same sliver. Widths follow a log scale instead; the circle carries the exact share.
 */
function barWidths(values: number[]): number[] {
  const positive = values.filter((v) => v > 0)
  if (positive.length === 0) return values.map(() => BAR_MIN)
  const hi = Math.log10(Math.max(...positive))
  const lo = Math.log10(Math.min(...positive))
  return values.map((v) => {
    if (v <= 0) return BAR_MIN
    if (hi === lo) return BAR_MAX
    return BAR_MIN + ((BAR_MAX - BAR_MIN) * (Math.log10(v) - lo)) / (hi - lo)
  })
}

function FunnelStages({ marketplace }: { marketplace: FunnelMarketplace }) {
  const stages = marketplace.stages
  const palette = FUNNEL_PALETTES[marketplace.name.toLowerCase()] ?? DEFAULT_PALETTE
  const widths = barWidths(stages.map((s) => s.value))
  const first = stages[0]?.value ?? 0

  return (
    <div className="flex flex-col">
      {stages.map((stage, i) => {
        const color = stageColor(palette, i, stages.length)
        const share = first > 0 ? stage.value / first : null
        const rate = i > 0 ? marketplace.rates[i - 1] : undefined
        const width = widths[i] ?? BAR_MIN
        const nextWidth = widths[i + 1]

        return (
          <div key={stage.key}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-12 w-12 flex-none items-center justify-center rounded-full font-mono text-[12px] font-semibold"
                style={{ background: color.bg, color: color.ink }}
                title="Persentase terhadap tahap pertama"
              >
                {share !== null ? formatPercent(share, share < 0.1 ? 2 : 1) : "—"}
              </div>
              <div className="relative h-12 min-w-0 flex-1">
                <div
                  className="flex h-full flex-col justify-center rounded-md px-3"
                  style={{ width: `${width}%`, background: color.bg, color: color.ink }}
                >
                  <span className="truncate text-[12px] font-bold tracking-wider uppercase">{stage.label}</span>
                  <span className="font-mono text-[13px] font-semibold">{formatNumber(stage.value)}</span>
                </div>
                <div
                  className="absolute top-1/2 flex -translate-y-1/2 flex-col pl-2 text-[12px] leading-tight"
                  style={{ left: `${width}%` }}
                >
                  <span className="font-semibold" style={{ color: deltaColor(stage.deltaPct) }}>
                    {formatSignedPercent(stage.deltaPct)}
                  </span>
                  {rate && (
                    <span className="whitespace-nowrap text-[var(--ov-faint)]">
                      {rate.label}{" "}
                      <span className="font-semibold text-[var(--ov-soft)]">
                        {rate.value !== null ? formatPercent(rate.value, 2) : "—"}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            {nextWidth !== undefined && (
              <div className="flex h-3 gap-3">
                {/* The spine joins the circles; the trapezoid narrows from this bar to the next. */}
                <div className="flex w-12 flex-none justify-center">
                  <div className="h-full w-1 bg-[var(--ov-track)]" />
                </div>
                <div
                  className="h-full min-w-0 flex-1 bg-[var(--ov-track)]"
                  style={{ clipPath: `polygon(0 0, ${width}% 0, ${nextWidth}% 100%, 0 100%)` }}
                />
              </div>
            )}
          </div>
        )
      })}
      <div className="mt-3 border-t border-[var(--ov-line)] pt-2 text-[12px] text-[var(--ov-faint)]">
        Lingkaran = persentase terhadap tahap pertama · % di samping batang = perubahan vs periode
        pembanding · lebar batang memakai skala log supaya tahap kecil tetap terbaca.
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  delta,
  missingNote = "tidak tersedia",
}: {
  label: string
  value: string | null
  delta: number | null
  missingNote?: string
}) {
  if (value === null) {
    return (
      <div>
        <div className="text-[12.5px] text-[var(--ov-mut)]">{label}</div>
        <div className="mt-0.5 font-mono text-[14px] font-semibold text-[var(--ov-dim)]">—</div>
        <div className="text-[13px] font-semibold text-[var(--ov-faint)]">{missingNote}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-[12.5px] text-[var(--ov-mut)]">{label}</div>
      <div className="mt-0.5 font-mono text-[14px] font-semibold">{value}</div>
      {delta !== null && (
        <div className="text-[13px] font-semibold" style={{ color: deltaColor(delta) }}>
          {formatSignedPercent(delta)}
        </div>
      )}
    </div>
  )
}
