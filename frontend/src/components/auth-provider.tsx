"use client"

import type { Session } from "next-auth"
import { SessionProvider } from "next-auth/react"
import { isSnapshot } from "@/lib/api"

/**
 * The session is resolved on the server in the root layout and handed down, so the first render
 * already knows who is signed in instead of flashing a signed-out state while it refetches.
 * Snapshot builds have no /api/auth to refetch from, so focus refetching is off there.
 */
export function AuthProvider({ session, children }: { session: Session | null; children: React.ReactNode }) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={!isSnapshot}>
      {children}
    </SessionProvider>
  )
}
