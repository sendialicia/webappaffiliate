"use client"

/**
 * Collapses the sidebar to an icon rail. Which state is showing is driven from
 * html[data-sidebar] in globals.css, so the markup is identical on server and
 * client and a collapsed sidebar never flashes open on load.
 */
export function SidebarToggle() {
  const toggle = () => {
    const root = document.documentElement
    const next = root.getAttribute("data-sidebar") === "rail" ? "full" : "rail"
    root.setAttribute("data-sidebar", next)
    try {
      localStorage.setItem("ov-sidebar", next)
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Buka atau tutup sidebar"
      className="sidebar-toggle flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-[var(--ov-track)] bg-[var(--ov-fill1)] text-[var(--ov-mut)] hover:bg-[var(--ov-nav-on)] hover:text-[var(--ov-ink)]"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9.5 4v16" />
        {/* Points into the sidebar when open, out of it when railed. */}
        <path className="sidebar-toggle-arrow" d="M17 9.5 14.5 12l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
