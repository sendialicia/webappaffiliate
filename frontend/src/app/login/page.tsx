import { redirect } from "next/navigation"
import { auth, signIn } from "@/auth"

/** Only same-site paths: an absolute or protocol-relative URL here would be an open redirect. */
function safeCallback(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/overview"
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const callbackUrl = safeCallback(params.callbackUrl)

  if ((await auth())?.user) redirect(callbackUrl)

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6" style={{ background: "var(--ov-page)" }}>
      <div
        className="w-full max-w-sm rounded-xl border border-[var(--ov-line)] p-7 shadow-[0_18px_34px_-22px_var(--ov-shadow)]"
        style={{ background: "var(--ov-card-gradient)" }}
      >
        <div className="text-xs font-semibold tracking-widest text-[var(--ov-label)] uppercase font-(family-name:--font-archivo)">
          Affiliate
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight font-(family-name:--font-archivo)">
          Paragon Affiliate Analytics
        </h1>
        <p className="mt-2 text-sm text-[var(--ov-mut)]">Masuk dengan akun Microsoft kantor untuk membuka dashboard.</p>

        {params.error && (
          <p className="mt-4 rounded-md border border-[var(--ov-red)]/40 bg-[var(--ov-red)]/10 px-3 py-2 text-[13px] text-[var(--ov-red-ink)]">
            Login gagal ({String(params.error)}). Coba lagi, atau hubungi tim IT kalau terus berulang.
          </p>
        )}

        <form
          className="mt-6"
          action={async () => {
            "use server"
            await signIn("azure-ad", { redirectTo: callbackUrl })
          }}
        >
          <button
            type="submit"
            className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg bg-[#2f2f2f] text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            Masuk dengan Microsoft
          </button>
        </form>
      </div>
    </div>
  )
}
