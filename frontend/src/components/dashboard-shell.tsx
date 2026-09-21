"use client"

import Link from "next/link"
import { useEffect, useSyncExternalStore, type ReactNode } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/user-menu"
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
  { key: "tiktok-pid", label: "TikTok PID", href: "/tiktok-pid", sub: true },
  { key: "sku", label: "SKU", href: "/sku", sub: true },
  { key: "creator", label: "Creator", icon: CreatorIcon, soon: true },
]

const PRODUCT_PAGES = ["shopee-pid", "tiktok-pid", "sku"]

const STORAGE_KEY = "ov-sidebar-collapsed"

export interface SectionLink {
  id: string
  label: string
}

/** The Paragon mark, reversed to white on the brand-blue chip. */
function ParagonMark({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.94} viewBox="0 0 100 94" fill="#ffffff" aria-hidden="true">
      <path d="M2 3 L37.6 3 L48.9 41.8 L31.8 55.6 Z" />
      <path d="M98 3 L62.4 3 L51.1 41.8 L68.2 55.6 Z" />
      <path d="M50 43.8 L34.2 58.2 L50 91 L65.8 58.2 Z" />
    </svg>
  )
}

/**
 * The collapsed flag lives outside React so it can be read straight from localStorage during
 * render instead of being written back in through an effect, which would cost a second render
 * on every page and trip react-hooks/set-state-in-effect.
 */
const sidebarStore = {
  listeners: new Set<() => void>(),
  subscribe(fn: () => void) {
    sidebarStore.listeners.add(fn)
    return () => void sidebarStore.listeners.delete(fn)
  },
  get(): boolean {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1"
    } catch {
      // Private browsing or blocked storage — expanded is the right default.
      return false
    }
  },
  toggle() {
    const next = !sidebarStore.get()
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
    } catch {
      // Ignore: the toggle still works for this render pass.
    }
    for (const fn of sidebarStore.listeners) fn()
  },
}

/**
 * Collapse is deliberately manual rather than tied to scroll position: the section list
 * ("Di halaman ini") is most useful precisely when the reader is scrolled down, and every chart
 * on the page re-measures when the main column changes width, so collapsing on scroll would
 * reflow the thing being read. Persisted so the choice survives navigation.
 */
function useSidebarCollapsed(): [boolean, () => void] {
  // The server has no localStorage, so it always renders expanded and the client reconciles.
  const collapsed = useSyncExternalStore(sidebarStore.subscribe, sidebarStore.get, () => false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return
      e.preventDefault()
      sidebarStore.toggle()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return [collapsed, sidebarStore.toggle]
}

function CollapseButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
      title={`${collapsed ? "Buka" : "Tutup"} sidebar  ·  [`}
      className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-[var(--ov-track)] text-[var(--ov-faint)] hover:bg-[var(--ov-fill1)] hover:text-[var(--ov-ink)]"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M10 4v16" />
        {collapsed ? <path d="M14.5 9.5 17 12l-2.5 2.5" /> : <path d="M17 9.5 14.5 12 17 14.5" />}
      </svg>
    </button>
  )
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
  const [collapsed, toggle] = useSidebarCollapsed()
  // Sub-items carry no icon, so an icon rail can only show the top level.
  const navItems = collapsed ? NAV_ITEMS.filter((i) => !i.sub) : NAV_ITEMS

  return (
    <div className="flex min-h-screen">
      <aside
        className={`hidden flex-none flex-col border-r border-[var(--ov-line)] transition-[width] duration-200 md:flex ${
          collapsed ? "w-[64px]" : "w-[238px]"
        }`}
        style={{ background: "var(--ov-side)" }}
      >
        <div
          className={`flex items-center py-5 ${collapsed ? "flex-col gap-3 px-3" : "gap-2.5 px-4.5"}`}
        >
          <span
            className="flex h-9.5 w-9.5 flex-none items-center justify-center rounded-[9px]"
            style={{ background: "var(--ov-brand)" }}
            title="Paragon Corp"
          >
            <ParagonMark />
          </span>
          {!collapsed && (
            <span className="text-[15px] leading-tight font-bold font-(family-name:--font-archivo)">
              Affiliate
              <br />
              <span className="text-xs font-medium text-[var(--ov-label)]">Analytics</span>
            </span>
          )}
          {!collapsed && <span className="ml-auto" />}
          <CollapseButton collapsed={collapsed} onToggle={toggle} />
        </div>

        <nav className={`flex flex-col gap-0.5 ${collapsed ? "px-2" : "px-3"}`}>
          {navItems.map((item) => {
            const isActive =
              item.key === active || (item.key === "product" && PRODUCT_PAGES.includes(active))
            const className = collapsed
              ? "flex h-10 items-center justify-center rounded-lg"
              : `flex items-center gap-2.5 rounded-lg ${
                  item.sub
                    ? "py-2.5 pr-3 pl-10 text-[13.5px] font-medium"
                    : "px-3 py-2.5 text-[14.5px] font-semibold"
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
                {!collapsed && item.label}
                {!collapsed && item.soon && (
                  <span className="ml-auto text-[11.5px] font-semibold tracking-wide text-[var(--ov-dim)] uppercase">
                    segera
                  </span>
                )}
              </>
            )

            if (!item.href) {
              return (
                <span
                  key={item.key}
                  title={collapsed ? `${item.label} — belum dibangun` : "Halaman ini belum dibangun"}
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
                title={collapsed ? item.label : undefined}
                className={`${className} hover:bg-[var(--ov-fill1)]`}
                style={style}
              >
                {inner}
              </Link>
            )
          })}
        </nav>

        {!collapsed && sectionNav.length > 0 && (
          <div className="px-3 pt-5">
            <div className="px-3 pb-2 text-[12px] font-bold tracking-[0.14em] text-[var(--ov-faint)] uppercase">
              Di halaman ini
            </div>
            <div className="flex flex-col gap-px">
              {sectionNav.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-[var(--ov-head)] hover:bg-[var(--ov-fill1)] hover:text-[var(--ov-ink)]"
                >
                  <i className="block h-1 w-1 flex-none rounded-full bg-[var(--ov-blue)]" />
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        )}

        <div className={`mt-auto py-5 ${collapsed ? "px-2" : "px-4"}`}>
          <div
            className={`flex items-center rounded-lg border border-[var(--ov-track)] bg-[var(--ov-fill1)] ${
              collapsed ? "justify-center py-2.5" : "gap-2.5 px-3 py-2.5"
            }`}
            title={collapsed ? `Periode berjalan · ${formatMonthLabelFull(currentMonth())}` : undefined}
          >
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
            {!collapsed && (
              <span>
                <span className="block text-[12px] text-[var(--ov-label)]">Periode Berjalan</span>
                <span className="block text-sm font-semibold">{formatMonthLabelFull(currentMonth())}</span>
              </span>
            )}
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
          <div className="flex flex-wrap items-center gap-2">
            <UserMenu />
            <ThemeToggle />
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
