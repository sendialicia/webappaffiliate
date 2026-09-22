"use client"

import { useState } from "react"
import { formatCompact, formatIdr, formatSignedPercent } from "@/lib/format"
import type { DriverMatrixResult, MatrixCell } from "@/types/overview"

const OTHER = "Lainnya"

/** Below either bar a cell's growth is noise, not a finding (a 4-creator cell "up 139%"). */
const MIN_CREATORS = 5
const MIN_SHARE_OF_TOTAL = 0.001

type Lever = "creators" | "productivity"

interface CellRead {
  growth: number | null
  gmvPerCreator: number | null
  gmvPerCreatorPrev: number | null
  creatorsGrowth: number | null
  gpcGrowth: number | null
  /** Growth split into the part from more/fewer creators and the part from GMV per creator. */
  creatorPart: number | null
  productivityPart: number | null
  lever: Lever | null
  status: "normal" | "new" | "gone" | "small" | "empty"
}

const pct = (now: number, prev: number) => (prev > 0 ? (now - prev) / prev : null)

/**
 * GMV ≡ creators × GMV per creator, so ln(GMV ratio) = ln(creator ratio) + ln(GMV/creator ratio)
 * exactly. Each lever's share of the log move, applied to the growth, splits it with nothing
 * left over; the lever with the larger share is the one the cell names.
 */
function read(cell: MatrixCell | undefined, totalGmv: number): CellRead {
  const c = cell ?? { gmv: 0, gmvPrev: 0, creators: 0, creatorsPrev: 0 }
  const gpc = c.creators > 0 ? c.gmv / c.creators : null
  const gpcPrev = c.creatorsPrev > 0 ? c.gmvPrev / c.creatorsPrev : null
  const base: CellRead = {
    growth: pct(c.gmv, c.gmvPrev),
    gmvPerCreator: gpc,
    gmvPerCreatorPrev: gpcPrev,
    creatorsGrowth: pct(c.creators, c.creatorsPrev),
    gpcGrowth: gpc !== null && gpcPrev !== null ? pct(gpc, gpcPrev) : null,
    creatorPart: null,
    productivityPart: null,
    lever: null,
    status: "normal",
  }
  if (c.gmv <= 0 && c.gmvPrev <= 0) return { ...base, status: "empty" }
  if (c.gmvPrev <= 0) return { ...base, status: "new" }
  if (c.gmv <= 0) return { ...base, status: "gone" }

  const lnTotal = Math.log(c.gmv / c.gmvPrev)
  const lnCreators = c.creatorsPrev > 0 && c.creators > 0 ? Math.log(c.creators / c.creatorsPrev) : null
  if (lnCreators !== null && lnTotal !== 0 && base.growth !== null) {
    const lnProductivity = lnTotal - lnCreators
    base.creatorPart = base.growth * (lnCreators / lnTotal)
    base.productivityPart = base.growth * (lnProductivity / lnTotal)
    base.lever = Math.abs(lnCreators) >= Math.abs(lnProductivity) ? "creators" : "productivity"
  }
  const small =
    Math.max(c.creators, c.creatorsPrev) < MIN_CREATORS || Math.max(c.gmv, c.gmvPrev) < totalGmv * MIN_SHARE_OF_TOTAL
  return { ...base, status: small ? "small" : "normal" }
}

function leverLabel(r: CellRead): string {
  if (r.status === "new") return "baru di periode ini"
  if (r.status === "gone") return "tidak ada penjualan"
  if (r.status === "small") return "basis kecil"
  if (r.lever === null || r.growth === null) return ""
  if (r.growth >= 0) return r.lever === "creators" ? "didorong creator" : "didorong GMV/creator"
  return r.lever === "creators" ? "creator berkurang" : "GMV/creator turun"
}

/** Diverging fill: hue from the direction, strength from the size of the move, muted when noise. */
function fill(r: CellRead): string {
  if (r.status === "empty") return "transparent"
  if (r.status === "new") return "color-mix(in srgb, var(--ov-blue) 18%, transparent)"
  if (r.status === "gone") return "color-mix(in srgb, var(--ov-red) 22%, transparent)"
  const g = r.growth ?? 0
  const strength = r.status === "small" ? 6 : 10 + Math.min(Math.abs(g) / 0.5, 1) * 40
  return `color-mix(in srgb, ${g >= 0 ? "var(--ov-green)" : "var(--ov-red)"} ${strength.toFixed(0)}%, transparent)`
}

const growthColor = (g: number | null) =>
  g === null ? "var(--ov-faint)" : g >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)"

interface Hover {
  x: number
  y: number
  title: string
  cell: MatrixCell
  read: CellRead
}

export function DriverMatrix({
  result,
  entityLabel,
  dimensionLabel,
  compareLabel,
  onDrillAction,
}: {
  result: DriverMatrixResult
  entityLabel: string
  dimensionLabel: string
  compareLabel: string
  /** Filters the page to an entity, a dimension value, or both; null leaves that side alone. */
  onDrillAction: (entity: string | null, name: string | null) => void
}) {
  const [hover, setHover] = useState<Hover | null>(null)
  const totalGmv = result.total.gmv

  const track = (title: string, cell: MatrixCell | undefined) => (e: React.MouseEvent) => {
    if (!cell) return setHover(null)
    setHover({ x: e.clientX, y: e.clientY, title, cell, read: read(cell, totalGmv) })
  }

  const renderCell = (
    key: string,
    title: string,
    cell: MatrixCell | undefined,
    drill: (() => void) | null,
    emphasis = false,
  ) => {
    const r = read(cell, totalGmv)
    const empty = r.status === "empty"
    return (
      <td
        key={key}
        onMouseMove={empty ? undefined : track(title, cell)}
        onMouseLeave={() => setHover(null)}
        onClick={empty || !drill ? undefined : drill}
        className={`border-b border-l border-[var(--ov-line)] px-2.5 py-2 align-top ${drill && !empty ? "cursor-pointer hover:outline hover:outline-1 hover:outline-[var(--accent-foreground)]" : ""}`}
        style={{ background: fill(r) }}
      >
        {empty ? (
          <span className="text-[var(--ov-dim)]">—</span>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span className={`font-mono text-[13px] ${emphasis ? "font-bold" : "font-semibold"} text-[var(--ov-ink)]`}>
                {formatCompact(cell?.gmv ?? 0)}
              </span>
              {r.growth !== null && (
                <span
                  className="font-mono text-[12px] font-semibold"
                  style={{ color: r.status === "small" ? "var(--ov-faint)" : growthColor(r.growth) }}
                >
                  {r.growth >= 0 ? "▲" : "▼"}
                  {Math.abs(r.growth * 100).toFixed(1)}%
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[11.5px] whitespace-nowrap text-[var(--ov-faint)]">{leverLabel(r)}</div>
          </>
        )}
      </td>
    )
  }

  const hoverLeft = hover ? (hover.x + 340 > window.innerWidth ? hover.x - 330 : hover.x + 14) : 0

  return (
    <div>
      <div className="max-h-[600px] overflow-auto rounded-md border border-[var(--ov-line)]">
        <table className="border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr>
              <th
                className="sticky top-0 left-0 z-[3] min-w-[130px] border-b border-[var(--ov-line)] px-2.5 py-2 text-left text-[12px] font-bold tracking-wider text-[var(--ov-head)] uppercase"
                style={{ background: "linear-gradient(var(--accent), var(--accent)), var(--card)" }}
              >
                {entityLabel} \ {dimensionLabel}
              </th>
              <th
                className="sticky top-0 z-[2] min-w-[130px] border-b border-l border-[var(--ov-line)] px-2.5 py-2 text-left text-[12px] font-bold tracking-wider text-[var(--ov-head)] uppercase"
                style={{ background: "linear-gradient(var(--accent), var(--accent)), var(--card)" }}
              >
                Total
              </th>
              {result.names.map((name) => (
                <th
                  key={name}
                  onClick={name === OTHER ? undefined : () => onDrillAction(null, name)}
                  title={name === OTHER ? "Gabungan nilai di luar 20 teratas" : `Klik untuk memfilter halaman ke ${name}`}
                  className={`sticky top-0 z-[2] min-w-[130px] border-b border-l border-[var(--ov-line)] px-2.5 py-2 text-left text-[12px] font-bold tracking-wide text-[var(--ov-head)] uppercase ${name === OTHER ? "" : "cursor-pointer hover:text-[var(--accent-foreground)]"}`}
                  style={{ background: "linear-gradient(var(--accent), var(--accent)), var(--card)" }}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th
                className="sticky left-0 z-[1] border-b border-[var(--ov-line)] px-2.5 py-2 text-left text-[13px] font-bold"
                style={{ background: "var(--card)" }}
              >
                Semua {entityLabel.toLowerCase()}
              </th>
              {renderCell("total", "Total", result.total, null, true)}
              {result.names.map((name) =>
                renderCell(
                  `col-${name}`,
                  `Semua ${entityLabel.toLowerCase()} · ${name}`,
                  result.columnTotals[name],
                  name === OTHER ? null : () => onDrillAction(null, name),
                  true,
                ),
              )}
            </tr>
            {result.entities.map((entity) => (
              <tr key={entity}>
                <th
                  onClick={() => onDrillAction(entity, null)}
                  title={`Klik untuk memfilter halaman ke ${entity}`}
                  className="sticky left-0 z-[1] cursor-pointer border-b border-[var(--ov-line)] px-2.5 py-2 text-left text-[13px] font-semibold text-[var(--ov-soft)] hover:text-[var(--accent-foreground)]"
                  style={{ background: "var(--card)" }}
                >
                  {entity}
                </th>
                {renderCell(`${entity}-total`, `${entity} · total`, result.rowTotals[entity], () => onDrillAction(entity, null), true)}
                {result.names.map((name) =>
                  renderCell(
                    `${entity}-${name}`,
                    `${entity} · ${name}`,
                    result.cells[entity]?.[name],
                    name === OTHER ? null : () => onDrillAction(entity, name),
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] leading-relaxed text-[var(--ov-faint)]">
        <span>
          Warna: hijau naik, merah turun, makin pekat makin besar perubahannya · biru = baru di periode ini.
        </span>
        <span>
          &ldquo;Didorong creator / GMV per creator&rdquo; = tuas yang menjelaskan porsi terbesar perubahan GMV (GMV ≡
          creators × GMV per creator).
        </span>
        <span>
          &ldquo;Basis kecil&rdquo; = kurang dari {MIN_CREATORS} creator atau di bawah{" "}
          {(MIN_SHARE_OF_TOTAL * 100).toFixed(1)}% GMV total — growth-nya diredupkan karena mudah melonjak.
        </span>
        <span>Klik sel, nama baris, atau nama kolom untuk memfilter seluruh halaman · {compareLabel}.</span>
      </div>

      {hover && (
        // Follows the cursor, always below it and to its right (left only at the screen edge), so
        // it never covers the cell being read.
        <div
          className="pointer-events-none fixed z-[80] w-[320px] rounded-lg border px-3 py-2.5 text-[12.5px] shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
          style={{ left: hoverLeft, top: hover.y + 16, background: "var(--ov-tooltip)", borderColor: "var(--ov-line)" }}
        >
          <div className="mb-1.5 font-semibold text-[var(--ov-head)]">{hover.title}</div>
          <HoverRow label="GMV" now={formatIdr(hover.cell.gmv)} prev={formatIdr(hover.cell.gmvPrev)} change={hover.read.growth} />
          <HoverRow
            label="Creators"
            now={formatIdr(hover.cell.creators)}
            prev={formatIdr(hover.cell.creatorsPrev)}
            change={hover.read.creatorsGrowth}
          />
          <HoverRow
            label="GMV / creator"
            now={hover.read.gmvPerCreator !== null ? formatIdr(hover.read.gmvPerCreator) : "—"}
            prev={hover.read.gmvPerCreatorPrev !== null ? formatIdr(hover.read.gmvPerCreatorPrev) : "—"}
            change={hover.read.gpcGrowth}
          />
          {hover.read.creatorPart !== null && hover.read.productivityPart !== null && (
            <div className="mt-2 border-t border-[var(--ov-line)] pt-1.5 text-[12px] leading-relaxed text-[var(--ov-soft)]">
              Dari {formatSignedPercent(hover.read.growth)} perubahan GMV:{" "}
              <span style={{ color: growthColor(hover.read.creatorPart) }}>
                {formatSignedPercent(hover.read.creatorPart)}
              </span>{" "}
              dari jumlah creator,{" "}
              <span style={{ color: growthColor(hover.read.productivityPart) }}>
                {formatSignedPercent(hover.read.productivityPart)}
              </span>{" "}
              dari GMV per creator.
            </div>
          )}
          {hover.read.status === "small" && (
            <div className="mt-1.5 text-[12px] text-[var(--ov-gold-ink)]">
              Basis kecil — perubahan persen di sini mudah melonjak, baca bersama angka rupiahnya.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HoverRow({ label, now, prev, change }: { label: string; now: string; prev: string; change: number | null }) {
  return (
    <div className="grid grid-cols-[92px_1fr_auto] items-baseline gap-2 py-0.5">
      <span className="text-[var(--ov-faint)]">{label}</span>
      <span className="font-mono text-[var(--ov-ink)]">
        {now} <span className="text-[var(--ov-dim)]">dari {prev}</span>
      </span>
      <span className="font-mono font-semibold" style={{ color: growthColor(change) }}>
        {formatSignedPercent(change)}
      </span>
    </div>
  )
}
