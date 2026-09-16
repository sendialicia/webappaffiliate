"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/**
 * Picks any number of values. Empty means no restriction, which reads as "(Semua)" —
 * the same thing the old single-value "(All)" meant, so nothing changes for a reader
 * who never opens it.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChangeAction,
  width = "w-44",
}: {
  label: string
  options: string[]
  selected: string[]
  onChangeAction: (values: string[]) => void
  width?: string
}) {
  const summary =
    selected.length === 0 ? "(Semua)" : selected.length === 1 ? selected[0] : `${selected.length} dipilih`

  const toggle = (value: string) =>
    onChangeAction(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            title={selected.length > 0 ? selected.join(", ") : `Semua ${label.toLowerCase()}`}
            className={`flex h-8 ${width} items-center gap-2 rounded-full border border-[var(--ov-line)] bg-[var(--input)] px-3.5 text-[13px] text-[var(--ov-ink)]`}
          >
            <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
            <span className="text-[9px] text-[var(--ov-faint)]">▼</span>
          </button>
        }
      />
      <PopoverContent className="w-[260px] p-2" align="start">
        <div className="flex items-center gap-2 px-2 pb-2">
          <span className="text-[11px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">{label}</span>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChangeAction([])}
              className="ml-auto text-[11px] font-semibold text-[var(--accent-foreground)]"
            >
              Bersihkan
            </button>
          )}
        </div>
        <div className="flex max-h-[280px] flex-col overflow-y-auto">
          {options.length === 0 && (
            <span className="px-2 py-1.5 text-[12px] text-[var(--ov-faint)]">Belum ada pilihan.</span>
          )}
          {options.map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-[var(--ov-soft)] hover:bg-[var(--ov-fill1)]"
            >
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={() => toggle(option)}
                className="h-3.5 w-3.5 accent-[var(--ov-blue)]"
              />
              <span className="min-w-0 flex-1 truncate">{option}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
