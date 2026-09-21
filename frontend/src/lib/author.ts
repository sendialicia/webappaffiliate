"use client"

import { useSession } from "next-auth/react"
import type { Author } from "@/types/comments"

/**
 * Who the reader is, from the Microsoft SSO session. `id` is the Entra `oid`, which the backend
 * also receives from the proxy route — the backend takes identity from there, never from the
 * request body, so what this hook returns only drives the UI (showing edit/delete on your own
 * rows). Rows written before SSO keep `source: "local"` and a per-browser id, so they read as
 * someone else's.
 */
export function useAuthor(): { author: Author | null } {
  const { data } = useSession()
  const user = data?.user
  if (!user?.id) return { author: null }
  return { author: { id: user.id, name: user.name ?? user.email ?? "Tanpa nama", source: "entra" } }
}
