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

export function DownloadMenu({ items, filePrefix }: { items: DownloadItem[]; filePrefix: string }) {
  const stamp = new Date().toISOString().slice(0, 10)

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
        <div className="px-2 py-1.5 text-[11px] font-bold tracking-wider text-[var(--ov-faint)] uppercase">
          Unduh sebagai CSV
        </div>
        <div className="px-2 pb-2 text-[11px] leading-relaxed text-[var(--ov-faint)]">
          Isinya mengikuti filter yang sedang aktif di halaman ini.
        </div>
        <div className="flex flex-col">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                const rows = item.rows()
                if (rows.length > 0) downloadCsv(`${filePrefix}-${item.id}-${stamp}`, rows)
              }}
              className="rounded-md px-2 py-1.5 text-left text-[12.5px] font-medium text-[var(--ov-soft)] hover:bg-[var(--ov-fill1)]"
            >
              {item.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
