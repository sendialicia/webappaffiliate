"use client"

import { formatIdr, formatRpFull } from "@/lib/format"

import { decompose, type Lever } from "@/lib/lever-decompose"

export type { Lever }

function Bar({ delta, span }: { delta: number; span: number }) {
  const width = (Math.abs(delta) / span) * 46
  const positive = delta >= 0
  return (
    // Bars spread from a centre line rather than stacking, so the axis never has to be cut.
    <span className="relative block h-5">
      <span className="absolute -top-0.5 -bottom-0.5 left-1/2 w-px bg-[var(--ov-track)]" />
      <span
        className="absolute top-[3px] h-3.5 rounded-[3px]"
        style={{
          [positive ? "left" : "right"]: "50%",
          width: `${width.toFixed(1)}%`,
          background: positive ? "var(--ov-q-hi)" : "var(--ov-q-lo)",
        }}
      />
    </span>
  )
}

function Anchor({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-lg bg-[var(--ov-fill1)] px-3 py-2 text-[13px] text-[var(--ov-soft)]">
      <span>{label}</span>
      <span className="font-mono text-[13px] font-semibold">{formatRpFull(value)}</span>
    </div>
  )
}

function Band({ title, note, value }: { title: string; note: string; value: number }) {
  return (
    <div className="mt-2.5 flex items-baseline justify-between gap-3 border-b border-[var(--ov-track)] px-3 pb-1.5">
      <span className="text-[13px] font-semibold font-(family-name:--font-archivo)">
        {title}
        <span className="mt-0.5 block font-mono text-[12px] font-normal text-[var(--ov-faint)]">{note}</span>
      </span>
      <span
        className="font-mono text-[14px] font-semibold"
        style={{ color: value >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}
      >
        {value >= 0 ? "+" : "−"}
        {formatIdr(Math.abs(value))}
      </span>
    </div>
  )
}

export function LeverWaterfall({
  levers,
  gmvLabel,
  gmvPrev,
  gmv,
  ordersPrev,
  orders,
}: {
  /** Ordered upstream → downstream; the last one must be AOV. */
  levers: Lever[]
  /** What the anchors are measuring, spelled out so the reader knows which GMV this is. */
  gmvLabel: string
  gmvPrev: number
  gmv: number
  ordersPrev: number
  orders: number
}) {
  if (levers.length < 2 || gmvPrev <= 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--ov-line)] px-4 py-6 text-center text-[13px] text-[var(--ov-faint)]">
        Tidak ada data periode pembanding untuk pilihan ini, jadi perubahannya belum bisa diurai.
      </div>
    )
  }

  const parts = decompose(levers)
  const span = Math.max(...parts.map((p) => Math.abs(p.delta)), 1)
  const volume = parts.slice(0, -1)
  const value = parts[parts.length - 1]
  const volumeSum = volume.reduce((a, p) => a + p.delta, 0)
  const move = gmv - gmvPrev
  const biggest = [...parts].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
  const lead = Math.abs(volumeSum) >= Math.abs(value?.delta ?? 0) ? "jumlah order" : "nilai per order"

  const row = (part: { name: string; delta: number }) => {
    const lever = levers.find((l) => l.name === part.name)
    return (
      <div
        key={part.name}
        className="grid grid-cols-[minmax(0,1fr)_96px_92px] items-center gap-2.5 rounded-lg py-1.5 pr-3 pl-6 hover:bg-[var(--ov-fill2)]"
      >
        <span className="text-[13px] leading-snug text-[var(--ov-soft)]">
          {part.name}
          {lever && (
            <span className="mt-px block font-mono text-[12px] text-[var(--ov-faint)]">
              {lever.format(lever.prev)} → {lever.format(lever.now)}
            </span>
          )}
        </span>
        <Bar delta={part.delta} span={span} />
        <span
          className="text-right font-mono text-[13px]"
          style={{ color: part.delta >= 0 ? "var(--ov-green-ink)" : "var(--ov-red-ink)" }}
        >
          {part.delta >= 0 ? "+" : "−"}
          {formatIdr(Math.abs(part.delta))}
        </span>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-2.5 rounded-lg bg-[var(--ov-fill1)] px-3 py-2 text-center font-mono text-[13px] text-[var(--ov-mut)]">
        GMV = {levers.map((l) => l.name).join(" × ")}
      </p>

      <div className="flex flex-col gap-0.5">
        <Anchor label={`${gmvLabel} periode pembanding`} value={gmvPrev} />
        <Band
          title="Karena jumlah order"
          note={`${formatIdr(ordersPrev)} → ${formatIdr(orders)} order`}
          value={volumeSum}
        />
        {volume.map(row)}
        {value && levers[levers.length - 1] && (
          <>
            <Band
              title="Karena nilai per order"
              note={`${levers[levers.length - 1]?.format(levers[levers.length - 1]?.prev ?? 0)} → ${levers[levers.length - 1]?.format(levers[levers.length - 1]?.now ?? 0)}`}
              value={value.delta}
            />
            {row(value)}
          </>
        )}
        <Anchor label={`${gmvLabel} periode ini`} value={gmv} />
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--ov-faint)]">
        {gmvLabel} {move >= 0 ? "naik" : "turun"} {formatIdr(Math.abs(move))}, terutama karena{" "}
        <span className="font-semibold text-[var(--ov-mut)]">{lead}</span>
        {biggest && (
          <>
            ; penggerak terbesar{" "}
            <span className="font-semibold text-[var(--ov-mut)]">{biggest.name}</span> (
            {biggest.delta >= 0 ? "+" : "−"}
            {formatIdr(Math.abs(biggest.delta))})
          </>
        )}
        . Semua batang kalau dijumlah persis sama dengan selisih di atas dan di bawah — tanpa sisa,
        tanpa batang &ldquo;lain-lain&rdquo;.
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ov-faint)]">
        Perlu diingat saat membacanya: impresi dan klik itu angka seluruh produk, termasuk pembeli
        non-affiliate, sedangkan order dan GMV di sini hanya yang affiliate. Jadi{" "}
        <span className="font-semibold text-[var(--ov-mut)]">CO rate</span> di panel ini berarti
        order affiliate per klik produk, bukan rasio dalam satu populasi yang sama. Batangnya tetap
        menutup persis karena tiap rasio dibagi dengan penyebut yang sama seperti tuas di atasnya —
        tapi angkanya lebih rendah dari CO rate marketplace.
      </p>
    </div>
  )
}
