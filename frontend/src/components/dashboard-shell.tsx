import Link from "next/link"
import type { ReactNode } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { currentMonth } from "@/lib/date-range"
import { formatMonthLabelFull } from "@/lib/format"

const HomeIcon = (
  <>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
  </>
)

const BoxIcon = (
  <>
    <path d="M20 7 12 3 4 7v10l8 4 8-4V7z" />
    <path d="M4 7l8 4 8-4" />
    <path d="M12 11v10" />
  </>
)

const CreatorIcon = (
  <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M2.5 20c0-3.4 2.9-5.6 6.5-5.6s6.5 2.2 6.5 5.6" />
    <path d="M17 8.2a3 3 0 0 1 0 5.6" />
    <path d="M18.6 20c0-2.4-1-4.1-2.6-5" />
  </>
)

interface NavItem {
  key: string
  label: string
  href?: string
  icon?: ReactNode
  sub?: boolean
  /** Pages that are planned but not built yet stay visible, without a dead link. */
  soon?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: "overview", label: "Overview", href: "/overview", icon: HomeIcon },
  { key: "product", label: "Product", href: "/shopee-pid", icon: BoxIcon },
  { key: "shopee-pid", label: "Shopee PID", href: "/shopee-pid", sub: true },
  { key: "tiktok-pid", label: "TikTok PID", sub: true, soon: true },
  { key: "sku", label: "SKU", sub: true, soon: true },
  { key: "creator", label: "Creator", icon: CreatorIcon, soon: true },
]

const PRODUCT_PAGES = ["shopee-pid", "tiktok-pid", "sku"]

export interface SectionLink {
  id: string
  label: string
}

export function DashboardShell({
  title,
  subtitle,
  active = "overview",
  sectionNav = [],
  children,
}: {
  title: string
  subtitle: string
  active?: string
  /** In-page anchors listed under "Di halaman ini". */
  sectionNav?: SectionLink[]
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <aside
        className="hidden w-[238px] flex-none flex-col border-r border-[var(--ov-line)] md:flex"
        style={{ background: "var(--ov-side)" }}
      >
        <div className="flex items-center gap-2.5 px-4.5 py-5">
          <span
            className="flex h-9.5 w-9.5 flex-none items-center justify-center rounded-[9px] border border-[var(--ov-track)]"
            style={{ background: "var(--ov-logo)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ov-icon)" strokeWidth="1.5">
              <path d="M4 5h16L12 20 4 5z" />
              <path d="M9 9h6l-3 6-3-6z" fill="var(--ov-icon)" stroke="none" />
            </svg>
          </span>
          <span className="text-[15px] leading-tight font-bold font-(family-name:--font-archivo)">
            Affiliate
            <br />
            <span className="text-xs font-medium text-[var(--ov-label)]">Analytics</span>
          </span>
        </div>

        <nav className="flex flex-col gap-0.5 px-3">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.key === active || (item.key === "product" && PRODUCT_PAGES.includes(active))
            const className = `flex items-center gap-2.5 rounded-lg ${
              item.sub ? "py-2.5 pr-3 pl-10 text-[13.5px] font-medium" : "px-3 py-2.5 text-[14.5px] font-semibold"
            }`
            const style = isActive
              ? {
                  background: "var(--ov-nav-on)",
                  color: "var(--ov-nav-on-ink)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)",
                }
              : { color: "var(--ov-mut)" }

            const inner = (
              <>
                {item.icon && (
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="flex-none"
                  >
                    {item.icon}
                  </svg>
                )}
                {item.label}
                {item.soon && (
                  <span className="ml-auto text-[10px] font-semibold tracking-wide text-[var(--ov-dim)] uppercase">
                    segera
                  </span>
                )}
              </>
            )

            if (!item.href) {
              return (
                <span
                  key={item.key}
                  title="Halaman ini belum dibangun"
                  className={`${className} cursor-not-allowed`}
                  style={{ color: "var(--ov-dim)" }}
                >
                  {inner}
                </span>
              )
            }

            return (
              <Link
                key={item.key}
                href={item.href}
                className={`${className} hover:bg-[var(--ov-fill1)]`}
                style={style}
              >
                {inner}
              </Link>
            )
          })}
        </nav>

        {sectionNav.length > 0 && (
          <div className="px-3 pt-5">
            <div className="px-3 pb-2 text-[10.5px] font-bold tracking-[0.14em] text-[var(--ov-faint)] uppercase">
              Di halaman ini
            </div>
            <div className="flex flex-col gap-px">
              {sectionNav.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium text-[var(--ov-head)] hover:bg-[var(--ov-fill1)] hover:text-[var(--ov-ink)]"
                >
                  <i className="block h-1 w-1 flex-none rounded-full bg-[var(--ov-blue)]" />
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="mt-auto px-4 py-5">
          <div className="flex items-center gap-2.5 rounded-lg border border-[var(--ov-track)] bg-[var(--ov-fill1)] px-3 py-2.5">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ov-icon)"
              strokeWidth="1.5"
              className="flex-none"
            >
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            <span>
              <span className="block text-[11px] text-[var(--ov-label)]">Periode Berjalan</span>
              <span className="block text-sm font-semibold">{formatMonthLabelFull(currentMonth())}</span>
            </span>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6 md:px-8">
          <div>
            <div className="text-xs font-semibold tracking-widest text-[var(--ov-label)] uppercase font-(family-name:--font-archivo)">
              Affiliate
            </div>
            <div className="mt-1 text-3xl font-bold tracking-tight font-(family-name:--font-archivo)">{title}</div>
            <div className="mt-1 text-sm text-[var(--ov-mut)]">{subtitle}</div>
          </div>
          <ThemeToggle />
        </div>
        {children}
      </main>
    </div>
  )
}
