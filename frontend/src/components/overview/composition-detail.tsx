import { formatIdr, formatPercent, formatSignedPercent } from "@/lib/format"
import type { CompositionResult, CompositionRow } from "@/types/overview"

export function CompositionDetail({
  row,
  result,
  color,
  onCloseAction,
}: {
  row: CompositionRow
  result: CompositionResult
  color: string
  onCloseAction: () => void
}) {
  const shareOfChange = result.totals.delta !== 0 ? row.delta / result.totals.delta : null

  return (
    <div
      className="mt-3.5 rounded-xl border border-[var(--ov-line)] bg-[var(--ov-fill1)] p-4"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex flex-wrap items-baseline gap-2.5">
        <div className="text-base font-semibold font-(family-name:--font-archivo)">{row.name}</div>
        <div className="flex-1 text-xs text-[var(--ov-faint)]">
          {shareOfChange !== null ? `${formatPercent(shareOfChange, 0)} dari total perubahan GMV` : "—"} ·{" "}
          {row.delta >= 0 ? "+" : "−"}
          {formatIdr(Math.abs(row.delta))}
        </div>
        <button
          type="button"
          onClick={onCloseAction}
          className="rounded-md border border-[var(--ov-line)] px-2 py-1 text-xs text-[var(--ov-faint)] hover:text-[var(--ov-soft)]"
        >
          Tutup ✕
        </button>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DetailTile label="GMV" value={formatIdr(row.gmv)} sub={formatSignedPercent(row.growth)} subColor={(row.growth ?? 0) >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)"} />
        <DetailTile label="Share GMV" value={formatPercent(row.share)} sub="dari total afiliasi" />
        <DetailTile
          label="Creators"
          value={formatIdr(row.creators)}
          sub={`${formatSignedPercent(row.creatorsGrowth)} dari ${formatIdr(row.creatorsPrev)}`}
          subColor={(row.creatorsGrowth ?? 0) >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)"}
        />
        <DetailTile
          label="GMV per creator"
          value={formatIdr(row.gmvPerCreator)}
          sub={`dari ${formatIdr(row.gmvPerCreatorPrev)}`}
        />
      </div>
    </div>
  )
}

function DetailTile({
  label,
  value,
  sub,
  subColor,
}: {
  label: string
  value: string
  sub: string
  subColor?: string
}) {
  return (
    <div className="rounded-lg border border-[var(--ov-line)] bg-[var(--card)] px-3 py-2.5">
      <div className="text-[11px] tracking-wider text-[var(--ov-faint)] uppercase">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold">{value}</div>
      <div className="mt-0.5 text-[11.5px]" style={{ color: subColor ?? "var(--ov-faint)" }}>
        {sub}
      </div>
    </div>
  )
}
