import Link from "next/link"
import type { ReactNode } from "react"

const NAV_ITEMS = [
  { key: "overview", label: "Overview", href: "/overview" },
  { key: "shopee-pid", label: "Shopee PID", href: "/shopee-pid" },
]

export function DashboardShell({
  title,
  subtitle,
  active = "overview",
  children,
}: {
  title: string
  subtitle: string
  active?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 flex-none flex-col border-r border-[var(--ov-line)] bg-[var(--sidebar)] md:flex">
        <div className="flex items-center gap-2.5 px-5 py-6">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-[var(--ov-line)] bg-gradient-to-br from-[#27547f] to-[#1b3a63]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ov-blue)" strokeWidth="1.5">
              <path d="M4 5h16L12 20 4 5z" />
            </svg>
          </span>
          <span className="text-sm leading-tight font-bold font-(family-name:--font-archivo)">
            Affiliate
            <br />
            <span className="text-xs font-medium text-[var(--ov-label)]">Analytics</span>
          </span>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active
            return (
              <Link
                key={item.key}
                href={item.href}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold"
                style={{
                  background: isActive ? "var(--ov-fill1)" : "transparent",
                  color: isActive ? "var(--ov-ink)" : "var(--ov-mut)",
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-6 px-6 pt-6 md:px-8">
          <div>
            <div className="text-xs font-semibold tracking-widest text-[var(--ov-label)] uppercase font-(family-name:--font-archivo)">
              Affiliate
            </div>
            <div className="mt-1 text-3xl font-bold tracking-tight font-(family-name:--font-archivo)">{title}</div>
            <div className="mt-1 text-sm text-[var(--ov-mut)]">{subtitle}</div>
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
