"use client"

const OPTIONS = [
  {
    key: "dark",
    label: "Dark",
    icon: <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />,
  },
  {
    key: "light",
    label: "Light",
    icon: (
      <>
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </>
    ),
  },
] as const

export function ThemeToggle() {
  // Which pill reads as active is styled from html[data-theme] in globals.css, so the
  // markup stays identical on server and client and the saved theme never flashes.
  const apply = (next: string) => {
    document.documentElement.setAttribute("data-theme", next)
    try {
      localStorage.setItem("ov-theme", next)
    } catch {}
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-[var(--ov-line)] bg-[var(--ov-fill1)] p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.key}
          type="button"
          data-theme-pill={opt.key}
          aria-label={`Tema ${opt.label.toLowerCase()}`}
          onClick={() => apply(opt.key)}
          className="theme-pill flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--ov-mut)]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            {opt.icon}
          </svg>
          {opt.label}
        </button>
      ))}
    </div>
  )
}
