import { NextResponse } from "next/server"
import { auth } from "@/auth"

/**
 * The gate in front of every page and every data call. Pages without a session go to /login;
 * API calls get a 401 instead, since a redirect to an HTML page would only surface in the
 * browser as a JSON parse error. The backend proxy route re-checks the session itself — this
 * file is the first line, not the only one.
 */
export default auth((req) => {
  if (req.auth?.user) return

  const { pathname, search } = req.nextUrl
  if (pathname === "/login") return

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sesi login habis. Silakan masuk lagi." }, { status: 401 })
  }

  const login = new URL("/login", req.nextUrl.origin)
  login.searchParams.set("callbackUrl", `${pathname}${search}`)
  return NextResponse.redirect(login)
})

export const config = {
  // Auth.js's own routes and static assets stay open, or signing in could never start and the
  // login page would render without its CSS and fonts.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|snapshot/).*)"],
}
