"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { pillControlClass } from "@/components/filter-shell"
import { downloadCsv, type CsvRow } from "@/lib/csv"

export interface DownloadItem {
  id: string
  label: string
  /** Built on click, from the same data the section renders, so the file matches the screen. */
  rows: () => CsvRow[]
  /** Heading the item sits under in the menu, e.g. "Product deep dive". */
  group?: string
  /** Shown instead of a working button when there is nothing to download yet. */
  disabledHint?: string | null
}

export function DownloadMenu({
  items,
  filePrefix,
  highlightId,
}: {
  items: DownloadItem[]
  filePrefix: string
  /** The section the reader last interacted with — offered first so the obvious pick is one click. */
  highlightId?: string | null
}) {
  const stamp = new Date().toISOString().slice(0, 10)
  // Groups keep the order they first appear in; the recently used item is also offered on top.
  const groups: Array<{ name: string; items: DownloadItem[] }> = []
  for (const item of items) {
    const name = item.group ?? ""
    const g = groups.find((x) => x.name === name)
    if (g) g.items.push(item)
    else groups.push({ name, items: [item] })
  }
  const recent = highlightId ? items.find((i) => i.id === highlightId && !i.disabledHint) : undefined

  const renderItem = (item: DownloadItem, badge: boolean) => (
    <button
      key={`${badge ? "recent-" : ""}${item.id}`}
      type="button"
      disabled={!!item.disabledHint}
      title={item.disabledHint ?? undefined}
      onClick={() => {
        const rows = item.rows()
        if (rows.length > 0) downloadCsv(`${filePrefix}-${item.id}-${stamp}`, rows)
      }}
      className="flex flex-col items-start rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-[var(--ov-soft)] hover:bg-[var(--ov-fill1)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
    >
      <span className="flex w-full items-center gap-2">
        {item.label}
        {badge && (
          <span className="ml-auto flex-none rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--accent-foreground)]">
            baru dilihat
          </span>
        )}
      </span>
      {item.disabledHint && <span className="text-[11.5px] text-[var(--ov-faint)]">{item.disabledHint}</span>}
    </button>
  )

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button type="button" className={pillControlClass} title="Unduh data di balik tiap visual">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
            </svg>
            Download
          </button>
        }
      />
      <PopoverContent className="w-[320px] p-2" align="end">
        <div className="px-2 py-1.5 text-[12px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
          Unduh sebagai CSV
        </div>
        <div className="px-2 pb-2 text-[12px] leading-relaxed text-[var(--ov-faint)]">
          Isinya mengikuti filter yang sedang aktif di halaman ini.
        </div>
        <div className="flex max-h-[60vh] flex-col overflow-y-auto">
          {recent && <div className="mb-1 border-b border-[var(--ov-line)] pb-1">{renderItem(recent, true)}</div>}
          {groups.map((g) => (
            <div key={g.name || "_"} className="flex flex-col">
              {g.name && (
                <div className="px-2 pt-2 pb-0.5 text-[11px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
                  {g.name}
                </div>
              )}
              {g.items.map((item) => renderItem(item, false))}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
