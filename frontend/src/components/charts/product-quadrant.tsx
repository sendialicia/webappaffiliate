"use client"

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
    name: "GMV × Growth",
    why: "Memisahkan produk bervolume besar dari produk yang sedang tumbuh cepat.",
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
    name: "Clicks × CO Rate",
    why: "Membedakan produk yang ramai trafik dari produk yang efisien mengonversi.",
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
    name: "ASP × Units Sold",
    why: "Melihat posisi harga rata-rata terhadap volume penjualan.",
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
    name: "Commission Rate × Growth",
    why: "Mengecek apakah komisi yang lebih besar benar-benar berbuah pertumbuhan.",
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
    name: "Buyers × New Buyer Share",
    why: "Memisahkan produk dengan basis pembeli mapan dari produk yang menarik pembeli baru.",
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
  x: number
  y: number
  pid: string
  name: string
  inScope: boolean
}

export function ProductQuadrant({
  rows,
  preset,
  excludeOutliers,
  onSelectAction,
  height = 560,
}: {
  rows: PidProductRow[]
  preset: QuadrantPreset
  excludeOutliers: boolean
  onSelectAction: (pid: string) => void
  height?: number
}) {
  const spec = QUADRANT_PRESETS[preset]

  const all: Point[] = rows
    .map((r) => {
      const x = spec.x.value(r)
      const y = spec.y.value(r)
      if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) return null
      return { x, y, pid: r.pid, name: r.name, inScope: r.inScope }
    })
    .filter((p): p is Point => p !== null)

  let points = all
  if (excludeOutliers) {
    const [xLo, xHi] = iqrBounds(all.map((p) => p.x))
    const [yLo, yHi] = iqrBounds(all.map((p) => p.y))
    points = all.filter((p) => p.x >= xLo && p.x <= xHi && p.y >= yLo && p.y <= yHi)
  }

  const xMedian = median(points.map((p) => p.x))
  const yMedian = median(points.map((p) => p.y))

  const outOfScope = points.filter((p) => !p.inScope)
  const inScope = points.filter((p) => p.inScope)

  return (
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
          contentStyle={{ background: "#12263d", border: "1px solid var(--ov-line)", borderRadius: 8, fontSize: 12 }}
          content={({ payload }) => {
            const p = payload?.[0]?.payload as Point | undefined
            if (!p) return null
            return (
              <div className="rounded-lg border border-[var(--ov-line)] bg-[#12263d] px-3 py-2 text-xs">
                <div className="max-w-[240px] font-semibold">{p.name}</div>
                <div className="mt-1 font-mono text-[11px] text-[var(--ov-faint)]">PID {p.pid}</div>
                <div className="mt-1.5 font-mono text-[11.5px]">
                  {spec.x.label}: {spec.x.format(p.x)}
                </div>
                <div className="font-mono text-[11.5px]">
                  {spec.y.label}: {spec.y.format(p.y)}
                </div>
              </div>
            )
          }}
        />
        <Scatter name="Semua produk Shopee" data={outOfScope} fill="var(--ov-track)" fillOpacity={0.55} />
        <Scatter
          name="Produk pada cakupan ini"
          data={inScope}
          fill="var(--ov-gold)"
          onClick={(p: unknown) => {
            const pid = (p as Point | undefined)?.pid
            if (pid) onSelectAction(pid)
          }}
          style={{ cursor: "pointer" }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export function QuadrantLegendInfo({ preset }: { preset: QuadrantPreset }) {
  const spec = QUADRANT_PRESETS[preset]
  return (
    <div className="flex flex-col gap-1 text-[11.5px] text-[var(--ov-faint)]">
      <div className="text-[var(--ov-mut2)]">{spec.why}</div>
      <div className="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
        {spec.quadrants.map((q) => (
          <div key={q.pos} className="grid grid-cols-[76px_minmax(0,1fr)] gap-2">
            <span>{q.pos}</span>
            <span className="text-[var(--ov-mut2)]">{q.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-1">Garis putus-putus = median masing-masing sumbu.</div>
    </div>
  )
}
