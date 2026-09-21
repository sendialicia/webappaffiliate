"use client"

import { MultiSelect } from "@/components/multi-select"
import { useOverviewFilters } from "@/store/overview-filters"
import type { DetailFilters, FilterOption } from "@/types/overview"

/** Edits the pending draft — the reader applies it from the filter bar. */
export function DetailFilterSelects({ options }: { options: FilterOption[] }) {
  const { draft, setDraftDetail } = useOverviewFilters()

  return (
    <>
      {options.map((opt) => (
        <div key={opt.key} className="min-w-[132px] flex-1">
          <div className="mb-1.5 text-[12px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
            {opt.label}
          </div>
          <MultiSelect
            label={opt.label}
            options={opt.values}
            selected={draft.detail[opt.key] ?? []}
            onChangeAction={(values) => setDraftDetail(opt.key, values)}
            width="w-full"
          />
        </div>
      ))}
    </>
  )
}

export function activeDetailCount(detail: DetailFilters): number {
  return Object.values(detail).filter((v) => v && v.length > 0).length
}
