"use client"

import { signOut, useSession } from "next-auth/react"

/** Who is signed in, and the way out. Hidden until the session is known and in snapshot builds. */
export function UserMenu() {
  const { data } = useSession()
  const user = data?.user
  if (!user) return null

  const label = user.name ?? user.email ?? "Akun"
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--ov-line)] bg-[var(--ov-fill1)] py-0.5 pr-0.5 pl-1">
      <span
        className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12px] font-bold text-white"
        style={{ background: "var(--ov-brand)" }}
        aria-hidden="true"
      >
        {initials}
      </span>
      <span className="max-w-[160px] truncate text-xs font-semibold text-[var(--ov-soft)]" title={user.email ?? label}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => signOut({ redirectTo: "/login" })}
        className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--ov-mut)] hover:bg-[var(--ov-fill2)] hover:text-[var(--ov-red-ink)]"
      >
        Keluar
      </button>
    </div>
  )
}
