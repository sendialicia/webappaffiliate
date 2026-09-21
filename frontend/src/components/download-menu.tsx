"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { pillControlClass } from "@/components/filter-shell"
import { downloadCsv, type CsvRow } from "@/lib/csv"

export interface DownloadItem {
  id: string
  label: string
  /** Built on click, from the same data the section renders, so the file matches the screen. */
  rows: () => CsvRow[]
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
  const ordered = highlightId
    ? [...items].sort((a, b) => Number(b.id === highlightId) - Number(a.id === highlightId))
    : items

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
      <PopoverContent className="w-[290px] p-2" align="end">
        <div className="px-2 py-1.5 text-[12px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
          Unduh sebagai CSV
        </div>
        <div className="px-2 pb-2 text-[12px] leading-relaxed text-[var(--ov-faint)]">
          Isinya mengikuti filter yang sedang aktif di halaman ini.
        </div>
        <div className="flex flex-col">
          {ordered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                const rows = item.rows()
                if (rows.length > 0) downloadCsv(`${filePrefix}-${item.id}-${stamp}`, rows)
              }}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium text-[var(--ov-soft)] hover:bg-[var(--ov-fill1)]"
            >
              {item.label}
              {item.id === highlightId && (
                <span className="ml-auto rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--accent-foreground)]">
                  baru dilihat
                </span>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
