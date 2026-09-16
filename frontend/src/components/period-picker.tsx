"use client"

import type { ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DATE_PRESET_LABELS, type DatePreset } from "@/lib/date-range"

/** Previous-period range implied by the current range, used when the basis is "periode sebelumnya". */
export function impliedPrevRange(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from)
  const days = Math.round((new Date(to).getTime() - fromDate.getTime()) / 86_400_000) + 1
  const prevTo = new Date(fromDate)
  prevTo.setDate(prevTo.getDate() - 1)
  const prevFrom = new Date(prevTo)
  prevFrom.setDate(prevFrom.getDate() - (days - 1))
  return { from: iso(prevFrom), to: iso(prevTo) }
}

export function shiftYear(date: string): string {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() - 1)
  return iso(d)
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** A labelled field whose trigger shows only the resolved dates; the controls live in the popover. */
function RangeField({
  label,
  from,
  to,
  children,
}: {
  label: string
  from: string
  to: string
  children: ReactNode
}) {
  return (
    <div className="flex-none">
      <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">{label}</div>
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="flex h-8 items-center gap-2 rounded-md border border-[var(--ov-line)] bg-[var(--input)] px-3 font-mono text-[11.5px] font-semibold text-[var(--ov-soft)] hover:bg-[var(--ov-fill1)]"
            >
              {from} → {to}
              <span className="font-sans text-[9px] text-[var(--ov-faint)]">▼</span>
            </button>
          }
        />
        <PopoverContent className="w-[330px] p-3.5" align="start">
          {children}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function Chips<T extends string>({
  options,
  value,
  onSelectAction,
}: {
  options: { key: T; label: string }[]
  value: T
  onSelectAction: (key: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--ov-line)] bg-[var(--panel)] p-0.5">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          onClick={() => onSelectAction(opt.key)}
          className="rounded-md px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap"
          style={{
            background: value === opt.key ? "var(--ov-fill1)" : "transparent",
            color: value === opt.key ? "var(--ov-ink)" : "var(--ov-mut)",
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function DateInputs({
  from,
  to,
  onChangeAction,
}: {
  from: string
  to: string
  onChangeAction: (from: string, to: string) => void
}) {
  return (
    <div className="mt-2.5 flex items-center gap-1.5">
      <Input
        type="date"
        value={from}
        onChange={(e) => onChangeAction(e.target.value, to)}
        className="h-8 flex-1 bg-[var(--input)] text-xs"
      />
      <span className="text-xs text-[var(--ov-faint)]">→</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => onChangeAction(from, e.target.value)}
        className="h-8 flex-1 bg-[var(--input)] text-xs"
      />
    </div>
  )
}

export function CurrentPeriodField({
  preset,
  from,
  to,
  onPresetAction,
  onRangeAction,
}: {
  preset: DatePreset
  from: string
  to: string
  onPresetAction: (preset: DatePreset) => void
  onRangeAction: (from: string, to: string) => void
}) {
  return (
    <RangeField label="Current period" from={from} to={to}>
      <Chips
        options={(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((p) => ({
          key: p,
          label: DATE_PRESET_LABELS[p],
        }))}
        value={preset}
        onSelectAction={onPresetAction}
      />
      <DateInputs from={from} to={to} onChangeAction={onRangeAction} />
      <div className="mt-2 text-[11px] leading-relaxed text-[var(--ov-faint)]">
        Mengubah tanggal langsung memakai mode custom.
      </div>
    </RangeField>
  )
}

export type CompareBasisOption = "prev" | "ly" | "custom"

export function PreviousPeriodField({
  basis,
  from,
  to,
  resolvedFrom,
  resolvedTo,
  onBasisAction,
  onRangeAction,
}: {
  basis: CompareBasisOption
  /** The current period, used to derive what "periode sebelumnya" and "tahun lalu" resolve to. */
  from: string
  to: string
  resolvedFrom: string
  resolvedTo: string
  onBasisAction: (basis: CompareBasisOption) => void
  onRangeAction: (from: string, to: string) => void
}) {
  const implied = impliedPrevRange(from, to)

  return (
    <RangeField label="Previous period" from={resolvedFrom} to={resolvedTo}>
      <Chips
        options={[
          { key: "prev", label: "Periode sebelumnya" },
          { key: "ly", label: "Tahun lalu" },
          { key: "custom", label: "Custom" },
        ]}
        value={basis}
        onSelectAction={(key) => {
          if (key === "custom") onRangeAction(resolvedFrom || implied.from, resolvedTo || implied.to)
          else onBasisAction(key)
        }}
      />
      {basis === "custom" && <DateInputs from={resolvedFrom} to={resolvedTo} onChangeAction={onRangeAction} />}
      <div className="mt-2 text-[11px] leading-relaxed text-[var(--ov-faint)]">
        {basis === "custom"
          ? "Rentang pembanding dikunci ke tanggal di atas."
          : "Mengikuti panjang periode berjalan secara otomatis."}
      </div>
    </RangeField>
  )
}
