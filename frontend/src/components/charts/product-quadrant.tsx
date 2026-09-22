"use client"

import { useRef, useState, type ReactNode } from "react"
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts"
import { formatCompact } from "@/lib/format"
import type { PidProductRow, QuadrantPreset } from "@/types/shopee-pid"
import { TOOLTIP_PLACEMENT } from "@/lib/chart-tooltip"

/** The minimum a row must carry to be plotted; each page supplies its own richer row type. */
export interface QuadrantRow {
  pid: string
  name: string
  inScope: boolean
}

export interface AxisSpec<T> {
  label: string
  value: (r: T) => number | null
  format: (v: number) => string
}

export interface PresetSpec<T> {
  name: string
  /**
   * What the dot's area encodes. Defaults to GMV where the preset has one; presets that already
   * put GMV on an axis pass something else so the encoding is not spent twice.
   */
  size?: { label: string; value: (r: T) => number }
  /** What question this view answers — shown first so the reader can pick without trial and error. */
  purpose: string
  why: string
  x: AxisSpec<T>
  y: AxisSpec<T>
  quadrants: { pos: string; label: string }[]
}

export const money = (v: number) => formatCompact(v)
export const pct = (v: number) => `${v.toFixed(1)}%`
export const plain = (v: number) => formatCompact(v)

export const QUADRANT_PRESETS: Record<QuadrantPreset, PresetSpec<PidProductRow>> = {
  "gmv-growth": {
    size: { label: "jumlah creator", value: (r) => r.creators },
    name: "Skala × Momentum",
    purpose: "Cari tahu produk mana yang menopang GMV sekarang, dan mana yang sedang naik cepat.",
    why: "Sumbu X GMV periode ini, sumbu Y pertumbuhannya vs periode pembanding.",
    x: { label: "GMV", value: (r) => r.gmv, format: money },
    y: { label: "GMV Growth", value: (r) => (r.growth === null ? null : r.growth * 100), format: pct },
    quadrants: [
      { pos: "Kanan atas", label: "Besar dan tumbuh — penopang utama" },
      { pos: "Kiri atas", label: "Kecil tapi tumbuh — kandidat untuk didorong" },
      { pos: "Kanan bawah", label: "Besar tapi melambat — perlu diperiksa" },
      { pos: "Kiri bawah", label: "Kecil dan melambat — prioritas rendah" },
    ],
  },
  "clicks-corate": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "Efisiensi trafik · Clicks × CO Rate",
    purpose: "Cari produk yang ramai dilihat tapi jarang dibeli, atau sebaliknya.",
    why: "Sumbu X jumlah klik, sumbu Y rasio klik yang berujung order.",
    x: { label: "Clicks", value: (r) => r.spClicks, format: plain },
    y: { label: "CO Rate (centre)", value: (r) => (r.spCoRate === null ? null : r.spCoRate * 100), format: pct },
    quadrants: [
      { pos: "Kanan atas", label: "Trafik tinggi dan konversi bagus" },
      { pos: "Kiri atas", label: "Konversi bagus tapi trafik kurang" },
      { pos: "Kanan bawah", label: "Trafik terbuang — konversi rendah" },
      { pos: "Kiri bawah", label: "Sepi di kedua sisi" },
    ],
  },
  "asp-units": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "Harga × Volume · ASP × Units",
    purpose: "Lihat apakah produk bertahan lewat harga tinggi atau lewat jumlah terjual.",
    why: "Sumbu X harga jual rata-rata, sumbu Y unit terjual.",
    x: {
      label: "ASP",
      value: (r) => (r.itemsSold > 0 ? r.gmv / r.itemsSold : null),
      format: money,
    },
    y: { label: "Items Sold", value: (r) => r.itemsSold, format: plain },
    quadrants: [
      { pos: "Kanan atas", label: "Harga tinggi dan laku banyak" },
      { pos: "Kiri atas", label: "Harga rendah, volume besar" },
      { pos: "Kanan bawah", label: "Harga tinggi, volume tipis" },
      { pos: "Kiri bawah", label: "Harga rendah, volume tipis" },
    ],
  },
  "commrate-growth": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "Imbal hasil komisi · Rate × Growth",
    purpose: "Cek apakah komisi yang lebih besar benar-benar berbuah pertumbuhan.",
    why: "Sumbu X porsi komisi terhadap GMV, sumbu Y pertumbuhan GMV.",
    x: {
      label: "Commission Rate",
      value: (r) => (r.commissionRate === null ? null : r.commissionRate * 100),
      format: pct,
    },
    y: { label: "GMV Growth", value: (r) => (r.growth === null ? null : r.growth * 100), format: pct },
    quadrants: [
      { pos: "Kanan atas", label: "Komisi besar, tumbuh — mahal tapi berhasil" },
      { pos: "Kiri atas", label: "Komisi kecil, tumbuh — paling efisien" },
      { pos: "Kanan bawah", label: "Komisi besar, melambat — perlu diperiksa" },
      { pos: "Kiri bawah", label: "Komisi kecil, melambat" },
    ],
  },
  "buyers-newshare": {
    size: { label: "GMV", value: (r) => r.gmv },
    name: "Akuisisi pembeli · Buyers × New Share",
    purpose: "Pisahkan produk berbasis pembeli lama dari produk yang menarik pembeli baru.",
    why: "Sumbu X jumlah pembeli, sumbu Y porsi yang baru pertama kali membeli.",
    x: { label: "Buyers", value: (r) => r.spBuyers, format: plain },
    y: {
      label: "New Buyer Share",
      value: (r) => (r.spBuyers > 0 ? (r.spNewBuyers / r.spBuyers) * 100 : null),
      format: pct,
    },
    quadrants: [
      { pos: "Kanan atas", label: "Banyak pembeli dan banyak yang baru" },
      { pos: "Kiri atas", label: "Pembeli sedikit tapi mayoritas baru" },
      { pos: "Kanan bawah", label: "Basis pembeli mapan, akuisisi rendah" },
      { pos: "Kiri bawah", label: "Sedikit pembeli, sedikit yang baru" },
    ],
  },
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0)
}

function iqrBounds(values: number[]): [number, number] {
  if (values.length < 4) return [-Infinity, Infinity]
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0
  const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0
  const iqr = q3 - q1
  return [q1 - 1.5 * iqr, q3 + 1.5 * iqr]
}

interface Point {
  /** Plotted position — equal to the raw value, or pinned to the fence when the value sits outside it. */
  x: number
  y: number
  rawX: number
  rawY: number
  /** -1 pinned to the lower fence, 1 pinned to the upper fence, 0 not pinned. */
  pinX: -1 | 0 | 1
  pinY: -1 | 0 | 1
  pid: string
  name: string
  inScope: boolean
  /** Relative to the median lines; drives both the fill and the legend. */
  quadrant: Quadrant
  /** Area encoding, already normalised to a radius. */
  radius: number
}

/** Vertical half first, because that is the half the colour hue encodes. */
type Quadrant = 'hi-right' | 'hi-left' | 'lo-right' | 'lo-left'

/** Same order the presets list their quadrants in, so the legend can zip the two together. */
const QUADRANT_ORDER: Quadrant[] = ['hi-right', 'hi-left', 'lo-right', 'lo-left']

const QUADRANT_FILL: Record<Quadrant, string> = {
  'hi-right': 'var(--ov-q-hi)',
  'hi-left': 'var(--ov-q-hi-soft)',
  'lo-right': 'var(--ov-q-lo)',
  'lo-left': 'var(--ov-q-lo-soft)',
}

function pin(value: number, lo: number, hi: number): [number, -1 | 0 | 1] {
  if (value < lo) return [lo, -1]
  if (value > hi) return [hi, 1]
  return [value, 0]
}

/**
 * A clamped point is drawn as a triangle aimed off-scale instead of a circle, so a dense row of
 * them along a fence reads as "these continue past here" rather than as a wall of real data. The
 * earlier dashed ring plus separate chevrons overlapped into an unreadable smear once a few
 * hundred products piled onto the same fence.
 */
function QuadrantDot({
  cx,
  cy,
  payload,
  fill,
  fillOpacity = 1,
}: {
  cx?: number
  cy?: number
  payload?: Point
  fill?: string
  fillOpacity?: number
}) {
  if (cx === undefined || cy === undefined || !payload) return <g />
  const { pinX, pinY } = payload
  // Out-of-scope points keep the neutral fill passed in; in-scope ones take their quadrant's.
  const paint = fill === 'var(--ov-track)' ? fill : QUADRANT_FILL[payload.quadrant]
  if (pinX === 0 && pinY === 0) {
    return (
      <circle
        data-pid={payload.pid}
        cx={cx}
        cy={cy}
        r={payload.radius}
        fill={paint}
        fillOpacity={fillOpacity}
        stroke="var(--ov-card-gradient)"
        strokeWidth={0.75}
      />
    )
  }
  // SVG y grows downward, so a pin to the upper fence aims towards a smaller y.
  const deg = (Math.atan2(-pinY, pinX) * 180) / Math.PI
  return (
    <g data-pid={payload.pid} transform={`translate(${cx} ${cy}) rotate(${deg})`}>
      <path d="M 4.4 0 L -2.6 3.2 L -2.6 -3.2 Z" fill={paint} fillOpacity={fillOpacity * 0.8} />
    </g>
  )
}

/**
 * Domain with a little air on whichever side has clamped points, so their triangles sit just
 * inside the plot instead of being sliced in half by the axis.
 */
function paddedDomain(values: number[], lowPinned: boolean, highPinned: boolean): [number, number] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min || Math.abs(max) || 1) * 0.035
  return [lowPinned ? min - pad : min, highPinned ? max + pad : max]
}

export function ProductQuadrant<T extends QuadrantRow>({
  rows,
  spec,
  excludeOutliers,
  selectedPids,
  onSelectAction,
  onSelectManyAction,
  height = 560,
}: {
  rows: T[]
  /** The active preset, resolved by the page — each page owns its own preset map. */
  spec: PresetSpec<T>
  excludeOutliers: boolean
  selectedPids: string[]
  onSelectAction: (pid: string) => void
  /** Dragging a rectangle over the plot hands back every product inside it. */
  onSelectManyAction: (pids: string[]) => void
  height?: number
}) {

  type RawPoint = Pick<Point, "x" | "y" | "pid" | "name" | "inScope"> & { size: number }
  const raw = rows
    .map((r): RawPoint | null => {
      const x = spec.x.value(r)
      const y = spec.y.value(r)
      if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) return null
      const size = spec.size ? spec.size.value(r) : 0
      return { x, y, pid: r.pid, name: r.name, inScope: r.inScope, size: Number.isFinite(size) ? size : 0 }
    })
    .filter((p): p is RawPoint => p !== null)

  const [xLo, xHi] = excludeOutliers ? iqrBounds(raw.map((p) => p.x)) : [-Infinity, Infinity]
  const [yLo, yHi] = excludeOutliers ? iqrBounds(raw.map((p) => p.y)) : [-Infinity, Infinity]

  // Outliers stay on the chart, pinned to the fence on the side they fall outside, so the
  // scale stays readable without the product disappearing from the view.
  const placed = raw.map((p) => {
    const [x, pinX] = pin(p.x, xLo, xHi)
    const [y, pinY] = pin(p.y, yLo, yHi)
    return { ...p, x, y, rawX: p.x, rawY: p.y, pinX, pinY }
  })

  const inFence = placed.filter((p) => p.pinX === 0 && p.pinY === 0)
  const xMedian = median(inFence.map((p) => p.x))
  const yMedian = median(inFence.map((p) => p.y))

  // Area, not radius, carries the value — a dot twice the radius looks four times as big.
  const maxSize = Math.max(...placed.map((p) => Math.abs(p.size)), 0)
  const radiusOf = (size: number): number => {
    if (!spec.size || maxSize <= 0) return 3.2
    return 2.4 + 6.4 * Math.sqrt(Math.max(size, 0) / maxSize)
  }

  const points: Point[] = placed.map((p) => ({
    ...p,
    quadrant: `${p.y >= yMedian ? "hi" : "lo"}-${p.x >= xMedian ? "right" : "left"}` as Point["quadrant"],
    radius: radiusOf(p.size),
  }))

  const outOfScope = points.filter((p) => !p.inScope)
  const inScope = points.filter((p) => p.inScope)
  const pinnedCount = points.length - inFence.length

  const hasPoints = points.length > 0
  const xDomain: [number, number] | undefined = hasPoints
    ? paddedDomain(
        points.map((p) => p.x),
        points.some((p) => p.pinX === -1),
        points.some((p) => p.pinX === 1),
      )
    : undefined
  const yDomain: [number, number] | undefined = hasPoints
    ? paddedDomain(
        points.map((p) => p.y),
        points.some((p) => p.pinY === -1),
        points.some((p) => p.pinY === 1),
      )
    : undefined

  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 18, left: 4, bottom: 12 }}>
        <CartesianGrid stroke="var(--ov-line)" />
        <XAxis
          type="number"
          dataKey="x"
          name={spec.x.label}
          {...(xDomain ? { domain: xDomain } : {})}
          tickFormatter={(v) => spec.x.format(Number(v))}
          tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }}
          axisLine={{ stroke: "var(--ov-line)" }}
          tickLine={false}
          label={{ value: spec.x.label, position: "insideBottom", offset: -6, fill: "var(--ov-faint)", fontSize: 12 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={spec.y.label}
          {...(yDomain ? { domain: yDomain } : {})}
          tickFormatter={(v) => spec.y.format(Number(v))}
          tick={{ fill: "var(--ov-faint)", fontSize: 11.5 }}
          axisLine={false}
          tickLine={false}
          width={64}
          label={{ value: spec.y.label, angle: -90, position: "insideLeft", fill: "var(--ov-faint)", fontSize: 12 }}
        />
        <ZAxis range={[26, 26]} />
        <ReferenceLine x={xMedian} stroke="var(--ov-rule)" strokeDasharray="4 4" />
        <ReferenceLine y={yMedian} stroke="var(--ov-rule)" strokeDasharray="4 4" />
        <Tooltip {...TOOLTIP_PLACEMENT}
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{ background: "var(--ov-tooltip)", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as Point | undefined
            if (!p) return null
            const pinned = p.pinX !== 0 || p.pinY !== 0
            return (
              <div className="rounded-lg border border-[var(--ov-line)] bg-[var(--ov-tooltip)] px-3 py-2 text-xs">
                <div className="max-w-[240px] font-semibold">{p.name}</div>
                <div className="mt-1 font-mono text-[12px] text-[var(--ov-faint)]">PID {p.pid}</div>
                <div className="mt-1.5 font-mono text-[12.5px]">
                  {spec.x.label}: {spec.x.format(p.rawX)}
                </div>
                <div className="font-mono text-[12.5px]">
                  {spec.y.label}: {spec.y.format(p.rawY)}
                </div>
                {pinned && (
                  <div className="mt-1.5 max-w-[240px] text-[12px] leading-relaxed text-[var(--ov-gold-ink)]">
                    Outlier — angka di atas nilai sebenarnya, titiknya digambar di batas terluar skala.
                  </div>
                )}
              </div>
            )
          }}
        />
        <Scatter
          name="Semua produk Shopee"
          data={outOfScope}
          fill="var(--ov-track)"
          fillOpacity={0.55}
          shape={QuadrantDot}
        />
        <Scatter
          name="Produk pada cakupan ini"
          data={inScope}
          fill="var(--ov-gold)"
          shape={QuadrantDot}
          onClick={(p: unknown) => {
            const pid = (p as Point | undefined)?.pid
            if (pid) onSelectAction(pid)
          }}
          style={{ cursor: "pointer" }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )

  return (
    <div>
      <DragSelect onSelectManyAction={onSelectManyAction}>{chart}</DragSelect>
      {/* The legend names each quadrant, so a reader who cannot separate the two hues still gets
          the grouping from position — which is what actually defines a quadrant here. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
        {spec.quadrants.map((q, i) => {
          const key = QUADRANT_ORDER[i]
          if (!key) return null
          return (
            <span key={q.pos} className="flex items-center gap-1.5">
              <i className="block h-2.5 w-2.5 flex-none rounded-full" style={{ background: QUADRANT_FILL[key] }} />
              <span className="font-semibold text-[var(--ov-soft)]">{q.pos}</span>
              <span className="text-[var(--ov-faint)]">{q.label}</span>
            </span>
          )
        })}
        {spec.size && (
          <span className="ml-auto flex items-center gap-1.5 text-[var(--ov-faint)]">
            <i className="block h-1.5 w-1.5 rounded-full bg-[var(--ov-mut)]" />
            <i className="block h-3 w-3 rounded-full bg-[var(--ov-mut)]" />
            ukuran titik = {spec.size.label}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[12.5px] text-[var(--ov-faint)]">
        <span>Tarik kursor di area chart untuk memilih beberapa produk sekaligus.</span>
        {selectedPids.length > 0 && (
          <span className="font-semibold text-[var(--accent-foreground)]">
            {selectedPids.length} produk terpilih · tabel produk ikut disaring
          </span>
        )}
        {excludeOutliers && pinnedCount > 0 && (
          <span>
            {pinnedCount} produk di luar pagar ditandai segitiga di batas skala; nilai aslinya ada di
            tooltip.
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Rubber-band selection. Each dot carries its pid in the DOM, so the rectangle is hit-tested
 * against the rendered circles — no access to the chart's internal scales needed.
 */
function DragSelect({
  onSelectManyAction,
  children,
}: {
  onSelectManyAction: (pids: string[]) => void
  children: ReactNode
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

  const pointFrom = (e: React.PointerEvent) => {
    const host = hostRef.current?.getBoundingClientRect()
    if (!host) return null
    return { x: e.clientX - host.left, y: e.clientY - host.top }
  }

  return (
    <div
      ref={hostRef}
      className="relative touch-none select-none"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        const p = pointFrom(e)
        if (!p) return
        startRef.current = p
        setBox({ left: p.x, top: p.y, width: 0, height: 0 })
      }}
      onPointerMove={(e) => {
        const start = startRef.current
        const p = start && pointFrom(e)
        if (!start || !p) return
        setBox({
          left: Math.min(start.x, p.x),
          top: Math.min(start.y, p.y),
          width: Math.abs(p.x - start.x),
          height: Math.abs(p.y - start.y),
        })
      }}
      onPointerUp={() => {
        const host = hostRef.current
        const current = box
        startRef.current = null
        setBox(null)
        // A click, not a drag: leave it to the dot's own click handler.
        if (!host || !current || current.width < 6 || current.height < 6) return

        const hostBox = host.getBoundingClientRect()
        const picked: string[] = []
        for (const node of host.querySelectorAll<SVGElement>("[data-pid]")) {
          const r = node.getBoundingClientRect()
          const cx = r.left + r.width / 2 - hostBox.left
          const cy = r.top + r.height / 2 - hostBox.top
          const pid = node.getAttribute("data-pid")
          if (
            pid &&
            cx >= current.left &&
            cx <= current.left + current.width &&
            cy >= current.top &&
            cy <= current.top + current.height
          ) {
            picked.push(pid)
          }
        }
        onSelectManyAction(picked)
      }}
    >
      {children}
      {box && box.width > 2 && box.height > 2 && (
        <div
          className="pointer-events-none absolute rounded border-2 border-dashed border-[var(--ov-blue)] bg-[var(--ov-blue)]/10"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        />
      )}
    </div>
  )
}

/** The chart itself stays clean; everything explanatory lives behind this marker. */
export function QuadrantInfo<T>({
  spec,
  excludeOutliers = false,
}: {
  spec: PresetSpec<T>
  excludeOutliers?: boolean
}) {
  return (
    <span className="group relative inline-flex">
      <span
        className="flex h-6 w-6 cursor-help items-center justify-center rounded-full border border-[var(--ov-line)] text-[12px] font-bold text-[var(--ov-faint)]"
        aria-label="Keterangan quadrant"
      >
        i
      </span>
      <span className="pointer-events-none absolute top-full right-0 z-50 hidden pt-2 group-hover:block">
        <span
          className="block w-[360px] rounded-[10px] border border-[var(--ov-track)] p-3.5 text-[12.5px] shadow-[0_18px_40px_-16px_var(--ov-shadow)]"
          style={{ background: "var(--ov-tooltip)" }}
        >
          <span className="block text-[13px] font-semibold text-[var(--ov-soft)]">{spec.purpose}</span>
          <span className="mt-1.5 block text-[var(--ov-faint)]">{spec.why}</span>
          <span className="mt-2.5 block border-t border-[var(--ov-line)] pt-2.5">
            {spec.quadrants.map((q) => (
              <span key={q.pos} className="mt-1 grid grid-cols-[76px_minmax(0,1fr)] gap-2">
                <span className="text-[var(--ov-faint)]">{q.pos}</span>
                <span className="text-[var(--ov-mut2)]">{q.label}</span>
              </span>
            ))}
          </span>
          <span className="mt-2.5 block border-t border-[var(--ov-line)] pt-2.5 text-[var(--ov-faint)]">
            Garis putus-putus = median masing-masing sumbu. Tarik kursor di area chart untuk memilih
            beberapa produk sekaligus.
            {excludeOutliers
              ? " Skala mengikuti pagar IQR 1.5×; produk di luar pagar tetap tampil sebagai segitiga di batas skala, mengarah ke sisi nilai aslinya."
              : ""}
          </span>
        </span>
      </span>
    </span>
  )
}
