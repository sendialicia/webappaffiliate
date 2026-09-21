import type { NextRequest } from "next/server"
import { auth } from "@/auth"

/**
 * The browser never talks to the Express backend directly. Every data call comes here, is
 * checked against the Auth.js session, and is forwarded with a shared internal secret plus the
 * signed-in user's identity. The backend refuses anything without that secret, so the API is
 * closed even to someone who can reach its port, and no token ever sits in the browser.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000"

/** Upstream headers worth passing back. Encoding and length are dropped: fetch already decoded. */
const PASSTHROUGH = ["content-type", "x-cache"]

async function forward(req: NextRequest, ctx: RouteContext<"/api/backend/[...path]">): Promise<Response> {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Sesi login habis. Silakan masuk lagi." }, { status: 401 })
  }

  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) {
    return Response.json({ error: "INTERNAL_API_SECRET belum di-set di frontend/.env.local" }, { status: 500 })
  }

  const { path } = await ctx.params
  const target = `${BACKEND_URL}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`

  const headers = new Headers({
    "x-internal-secret": secret,
    "x-user-id": session.user.id,
    // Header values are ASCII-only; names can carry any script, so they travel encoded.
    "x-user-name": encodeURIComponent(session.user.name ?? ""),
    "x-user-email": encodeURIComponent(session.user.email ?? ""),
  })
  const contentType = req.headers.get("content-type")
  if (contentType) headers.set("content-type", contentType)

  const hasBody = req.method !== "GET" && req.method !== "HEAD"

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      cache: "no-store",
    })
  } catch {
    return Response.json(
      { error: `Backend tidak merespons di ${BACKEND_URL}. Pastikan \`npm run dev\` di folder backend sedang jalan.` },
      { status: 502 },
    )
  }

  const out = new Headers()
  for (const name of PASSTHROUGH) {
    const value = upstream.headers.get(name)
    if (value) out.set(name, value)
  }
  return new Response(upstream.body, { status: upstream.status, headers: out })
}

export const GET = forward
export const POST = forward
export const PATCH = forward
export const PUT = forward
export const DELETE = forward
