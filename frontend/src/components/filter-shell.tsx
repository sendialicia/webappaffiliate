"use client"

import type { ReactNode } from "react"

/**
 * The filter bar floats over the page as a single pill instead of a full-width band,
 * so the content behind it stays visible while it follows the scroll.
 */
export function FloatingFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-3 z-30 px-4 pt-3 md:px-6">
      <div
        // Wraps rather than scrolling sideways: a control the reader cannot see is a
        // control they will not find, and this bar now carries every filter on the page.
        className="flex flex-wrap items-center gap-x-1 gap-y-2 rounded-[22px] border border-[var(--ov-line)] px-3 py-1.5 shadow-[0_18px_40px_-20px_var(--ov-shadow)] backdrop-blur-xl"
        style={{ background: "color-mix(in srgb, var(--background) 82%, transparent)" }}
      >
        {children}
      </div>
    </div>
  )
}

/** One labelled slot inside the pill: a micro caption with its control beside it. */
export function FilterItem({
  label,
  children,
  grow = false,
}: {
  label: string
  children: ReactNode
  grow?: boolean
}) {
  return (
    <div className={`flex items-center gap-2 px-1.5 ${grow ? "min-w-[170px] flex-1" : "flex-none"}`}>
      <span className="text-[10.5px] leading-tight font-bold tracking-wider whitespace-nowrap text-[var(--ov-faint)] uppercase">
        {label}
      </span>
      {children}
    </div>
  )
}

export function FilterDivider() {
  return <span className="h-6 w-px flex-none bg-[var(--ov-line)]" />
}

/**
 * Apply and the other actions stay reachable at the right edge even once the filters
 * outgrow the pill and it starts scrolling sideways.
 */
export function FilterActions({ children }: { children: ReactNode }) {
  return <div className="ml-auto flex flex-none items-center gap-1.5 pl-1.5">{children}</div>
}

/** Shared look for the round controls sitting inside the pill. */
export const pillControlClass =
  "flex h-8 items-center gap-2 rounded-full border border-[var(--ov-line)] bg-[var(--input)] px-3.5 text-xs font-semibold whitespace-nowrap text-[var(--ov-soft)] hover:bg-[var(--ov-fill1)]"
