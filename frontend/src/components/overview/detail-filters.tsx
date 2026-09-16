"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useOverviewFilters } from "@/store/overview-filters"
import type { FilterOption } from "@/types/overview"

const ALL = "__all__"

export function DetailFilterSelects({
  options,
  compact = false,
}: {
  options: FilterOption[]
  compact?: boolean
}) {
  const { detail, setDetailFilter } = useOverviewFilters()

  return (
    <>
      {options.map((opt) => (
        <div key={opt.key} className={compact ? "min-w-[132px] flex-1" : "min-w-[140px] flex-1"}>
          <div className="mb-1.5 text-[10.5px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
            {opt.label}
          </div>
          <Select
            value={detail[opt.key] ?? ALL}
            onValueChange={(v) => v && setDetailFilter(opt.key, v === ALL ? null : v)}
          >
            <SelectTrigger className="h-8 w-full bg-[var(--input)] text-[13px]">
              <SelectValue>{(v: string) => (v === ALL || !v ? "(All)" : v)}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[320px]">
              <SelectItem value={ALL}>(All)</SelectItem>
              {opt.values.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </>
  )
}

export function activeDetailCount(detail: Record<string, string | undefined>): number {
  return Object.values(detail).filter(Boolean).length
}
