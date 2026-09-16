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

interface AxisSpec {
  label: string
  value: (r: PidProductRow) => number | null
  format: (v: number) => string
}

interface PresetSpec {
  name: string
  /** What question this view answers — shown first so the reader can pick without trial and error. */
  purpose: string
  why: string
  x: AxisSpec
  y: AxisSpec
  quadrants: { pos: string; label: string }[]
}

const money: AxisSpec["format"] = (v) => formatCompact(v)
const pct: AxisSpec["format"] = (v) => `${v.toFixed(1)}%`
const plain: AxisSpec["format"] = (v) => formatCompact(v)

export const QUADRANT_PRESETS: Record<QuadrantPreset, PresetSpec> = {
  "gmv-growth": {
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
    name: "Efisiensi trafik · Clicks × CO Rate",
    purpose: "Cari produk yang ramai dilihat tapi jarang dibeli, atau sebaliknya.",
    why: "Sumbu X jumlah klik, sumbu Y rasio klik yang berujung order.",
    x: { label: "Clicks", value: (r) => r.spClicks, format: plain },
    y: { label: "CO Rate", value: (r) => (r.spCoRate === null ? null : r.spCoRate * 100), format: pct },
    quadrants: [
      { pos: "Kanan atas", label: "Trafik tinggi dan konversi bagus" },
      { pos: "Kiri atas", label: "Konversi bagus tapi trafik kurang" },
      { pos: "Kanan bawah", label: "Trafik terbuang — konversi rendah" },
      { pos: "Kiri bawah", label: "Sepi di kedua sisi" },
    ],
  },
  "asp-units": {
    name: "Harga × Volume · ASP × Units",
    purpose: "Lihat apakah produk bertahan lewat harga tinggi atau lewat jumlah terjual.",
    why: "Sumbu X harga jual rata-rata, sumbu Y unit terjual.",
    x: {
      label: "ASP",
      value: (r) => (r.spProductSold > 0 ? r.spGmv / r.spProductSold : null),
      format: money,
    },
    y: { label: "Units Sold", value: (r) => r.spProductSold, format: plain },
    quadrants: [
      { pos: "Kanan atas", label: "Harga tinggi dan laku banyak" },
      { pos: "Kiri atas", label: "Harga rendah, volume besar" },
      { pos: "Kanan bawah", label: "Harga tinggi, volume tipis" },
      { pos: "Kiri bawah", label: "Harga rendah, volume tipis" },
    ],
  },
  "commrate-growth": {
    name: "Imbal hasil komisi · Rate × Growth",
    purpose: "Cek apakah komisi yang lebih besar benar-benar berbuah pertumbuhan.",
    why: "Sumbu X porsi komisi terhadap GMV, sumbu Y pertumbuhan GMV.",
    x: {
      label: "Commission Rate",
      value: (r) => (r.spGmv > 0 ? (r.spCommission / r.spGmv) * 100 : null),
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
}

function pin(value: number, lo: number, hi: number): [number, -1 | 0 | 1] {
  if (value < lo) return [lo, -1]
  if (value > hi) return [hi, 1]
  return [value, 0]
}

function OutlierDot({
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
  if (pinX === 0 && pinY === 0) {
    return <circle data-pid={payload.pid} cx={cx} cy={cy} r={3.2} fill={fill} fillOpacity={fillOpacity} />
  }
  // A pinned product sits at the fence, not at its real value, so it gets a solid
  // arrowhead aimed the way its value actually ran off the chart. SVG y grows
  // downward, so an upper-fence pin (pinY 1) points towards a smaller y.
  const angle = (Math.atan2(-pinY, pinX) * 180) / Math.PI
  return (
    <path
      data-pid={payload.pid}
      d="M 5.6 0 L -3.6 4.3 L -3.6 -4.3 Z"
      fill={fill}
      fillOpacity={fillOpacity}
      transform={`translate(${cx} ${cy}) rotate(${angle})`}
    />
  )
}

export function ProductQuadrant({
  rows,
  preset,
  excludeOutliers,
  selectedPids,
  onSelectAction,
  onSelectManyAction,
  height = 560,
}: {
  rows: PidProductRow[]
  preset: QuadrantPreset
  excludeOutliers: boolean
  selectedPids: string[]
  onSelectAction: (pid: string) => void
  /** Dragging a rectangle over the plot hands back every product inside it. */
  onSelectManyAction: (pids: string[]) => void
  height?: number
}) {
  const spec = QUADRANT_PRESETS[preset]

  type RawPoint = Pick<Point, "x" | "y" | "pid" | "name" | "inScope">
  const raw = rows
    .map((r): RawPoint | null => {
      const x = spec.x.value(r)
      const y = spec.y.value(r)
      if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) return null
      return { x, y, pid: r.pid, name: r.name, inScope: r.inScope }
    })
    .filter((p): p is RawPoint => p !== null)

  const [xLo, xHi] = excludeOutliers ? iqrBounds(raw.map((p) => p.x)) : [-Infinity, Infinity]
  const [yLo, yHi] = excludeOutliers ? iqrBounds(raw.map((p) => p.y)) : [-Infinity, Infinity]

  // Outliers stay on the chart, pinned to the fence on the side they fall outside, so the
  // scale stays readable without the product disappearing from the view.
  const points: Point[] = raw.map((p) => {
    const [x, pinX] = pin(p.x, xLo, xHi)
    const [y, pinY] = pin(p.y, yLo, yHi)
    return { ...p, x, y, rawX: p.x, rawY: p.y, pinX, pinY }
  })

  const inFence = points.filter((p) => p.pinX === 0 && p.pinY === 0)
  const xMedian = median(inFence.map((p) => p.x))
  const yMedian = median(inFence.map((p) => p.y))

  const outOfScope = points.filter((p) => !p.inScope)
  const inScope = points.filter((p) => p.inScope)
  const pinnedCount = points.length - inFence.length

  const chart = (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 18, left: 4, bottom: 12 }}>
        <CartesianGrid stroke="var(--ov-line)" />
        <XAxis
          type="number"
          dataKey="x"
          name={spec.x.label}
          tickFormatter={(v) => spec.x.format(Number(v))}
          tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
          axisLine={{ stroke: "var(--ov-line)" }}
          tickLine={false}
          label={{ value: spec.x.label, position: "insideBottom", offset: -6, fill: "var(--ov-faint)", fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={spec.y.label}
          tickFormatter={(v) => spec.y.format(Number(v))}
          tick={{ fill: "var(--ov-faint)", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={64}
          label={{ value: spec.y.label, angle: -90, position: "insideLeft", fill: "var(--ov-faint)", fontSize: 11 }}
        />
        <ZAxis range={[26, 26]} />
        <ReferenceLine x={xMedian} stroke="var(--ov-rule)" strokeDasharray="4 4" />
        <ReferenceLine y={yMedian} stroke="var(--ov-rule)" strokeDasharray="4 4" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          contentStyle={{ background: "var(--ov-tooltip)", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as Point | undefined
            if (!p) return null
            const pinned = p.pinX !== 0 || p.pinY !== 0
            return (
              <div className="rounded-lg border border-[var(--ov-line)] bg-[var(--ov-tooltip)] px-3 py-2 text-xs">
                <div className="max-w-[240px] font-semibold">{p.name}</div>
                <div className="mt-1 font-mono text-[11px] text-[var(--ov-faint)]">PID {p.pid}</div>
                <div className="mt-1.5 font-mono text-[11.5px]">
                  {spec.x.label}: {spec.x.format(p.rawX)}
                </div>
                <div className="font-mono text-[11.5px]">
                  {spec.y.label}: {spec.y.format(p.rawY)}
                </div>
                {pinned && (
                  <div className="mt-1.5 max-w-[240px] text-[11px] leading-relaxed text-[var(--ov-gold-ink)]">
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
          shape={OutlierDot}
        />
        <Scatter
          name="Produk pada cakupan ini"
          data={inScope}
          fill="var(--ov-gold)"
          shape={OutlierDot}
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
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11.5px] text-[var(--ov-faint)]">
        <span>Tarik kursor di area chart untuk memilih beberapa produk sekaligus.</span>
        {selectedPids.length > 0 && (
          <span className="font-semibold text-[var(--accent-foreground)]">
            {selectedPids.length} produk terpilih · tabel produk ikut disaring
          </span>
        )}
        {excludeOutliers && pinnedCount > 0 && (
          <span>
            {pinnedCount} produk di luar pagar digambar di batas terluar; nilai aslinya ada di tooltip.
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
export function QuadrantInfo({
  preset,
  excludeOutliers = false,
}: {
  preset: QuadrantPreset
  excludeOutliers?: boolean
}) {
  const spec = QUADRANT_PRESETS[preset]

  return (
    <span className="group relative inline-flex">
      <span
        className="flex h-6 w-6 cursor-help items-center justify-center rounded-full border border-[var(--ov-line)] text-[11px] font-bold text-[var(--ov-faint)]"
        aria-label="Keterangan quadrant"
      >
        i
      </span>
      <span className="pointer-events-none absolute top-full right-0 z-50 hidden pt-2 group-hover:block">
        <span
          className="block w-[360px] rounded-[10px] border border-[var(--ov-track)] p-3.5 text-[11.5px] shadow-[0_18px_40px_-16px_var(--ov-shadow)]"
          style={{ background: "var(--ov-tooltip)" }}
        >
          <span className="block text-[12.5px] font-semibold text-[var(--ov-soft)]">{spec.purpose}</span>
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
              ? " Skala mengikuti pagar IQR 1.5×; produk di luar pagar tetap tampil, dijepit ke batas terluar sisinya."
              : ""}
          </span>
        </span>
      </span>
    </span>
  )
}
