import { apiFetch } from "@/lib/api"

interface HealthResponse {
  status: string
}

export default async function Home() {
  let health: HealthResponse | null = null
  let error: string | null = null

  try {
    health = await apiFetch<HealthResponse>("/health")
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error"
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16">
      <h1 className="text-2xl font-semibold">Backend connectivity check</h1>
      {health ? (
        <pre className="rounded-lg border border-[var(--ov-line)] bg-[var(--ov-fill1)] px-4 py-2 font-mono text-sm text-[var(--ov-soft)]">
          {JSON.stringify(health, null, 2)}
        </pre>
      ) : (
        <p className="text-[var(--ov-red-ink)]">Failed to reach backend: {error}</p>
      )}
      <a
        href="/overview"
        className="rounded-lg border border-[var(--ov-line)] bg-[var(--ov-fill1)] px-4 py-2 text-sm font-semibold text-[var(--ov-soft)] hover:bg-[var(--ov-track)]"
      >
        Buka dashboard →
      </a>
    </div>
  )
}
